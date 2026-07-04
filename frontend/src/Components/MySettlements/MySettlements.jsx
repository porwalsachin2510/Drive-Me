"use client";

import { getActiveCurrency } from "../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./mysettlements.css";

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
  NOT_CALCULATED: "Not Calculated",
  CALCULATED: "Calculated",
  PENDING_PAYOUT: "Pending Payout",
  SETTLED: "Settled",
  DEBT_OUTSTANDING: "Debt Outstanding",
};

const formatMoney = (value, currency = getActiveCurrency()) =>
  `${Number(value || 0).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const formatTxnType = (type) =>
  (type || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function MySettlements() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--)
    years.push(y);

  const fetchSettlement = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/settlement/my-settlement", {
        params: { month, year },
      });
      if (response.data?.success) {
        setSettlement(response.data.settlement);
      } else {
        setError("Unable to load settlement details.");
      }
    } catch (err) {
      console.error("Error fetching settlement:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load your settlement details.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchSettlement();
  }, [fetchSettlement]);

  const currency = settlement?.currency || getActiveCurrency();

  return (
    <div className="mysettlements">
      <header className="mysettlements-header">
        <div>
          <h2 className="mysettlements-title">My Settlements</h2>
          <p className="mysettlements-subtitle">
            Your monthly earnings reconciliation with Drive Me Go. Commission is
            deducted in real time on each booking; this statement summarises
            your earnings, commission collected and net payable balance.
          </p>
        </div>
        <div className="mysettlements-filters">
          <div className="filter-group">
            <label htmlFor="ms-month">Month</label>
            <select
              id="ms-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="ms-year">Year</label>
            <select
              id="ms-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="mysettlements-loading">Loading settlement...</div>
      ) : error ? (
        <div className="mysettlements-error">{error}</div>
      ) : settlement ? (
        <>
          <div className="mysettlements-status-row">
            <span
              className={`mysettlements-status status-${settlement.status?.toLowerCase()}`}
            >
              {STATUS_LABELS[settlement.status] || settlement.status}
            </span>
            {settlement.settledAt && (
              <span className="mysettlements-settled-on">
                Settled on {formatDate(settlement.settledAt)}
              </span>
            )}
          </div>

          <div className="mysettlements-cards">
            <div className="ms-card">
              <span className="ms-card-label">Gross Earnings</span>
              <span className="ms-card-value">
                {formatMoney(settlement.grossEarnings, currency)}
              </span>
              <span className="ms-card-hint">Credited from bookings</span>
            </div>
            <div className="ms-card">
              <span className="ms-card-label">Commission Collected</span>
              <span className="ms-card-value negative">
                {formatMoney(settlement.commissionCollected, currency)}
              </span>
              <span className="ms-card-hint">Admin commission (real-time)</span>
            </div>
            <div className="ms-card">
              <span className="ms-card-label">Net Payable</span>
              <span className="ms-card-value positive">
                {formatMoney(settlement.netPayable, currency)}
              </span>
              <span className="ms-card-hint">Available for payout</span>
            </div>
            <div className="ms-card">
              <span className="ms-card-label">Commission Debt</span>
              <span
                className={`ms-card-value ${
                  settlement.commissionDebt > 0 ? "debt" : "neutral"
                }`}
              >
                {formatMoney(settlement.commissionDebt, currency)}
              </span>
              <span className="ms-card-hint">Owed on cash bookings</span>
            </div>
          </div>

          {settlement.commissionDebt > 0 && (
            <div className="mysettlements-debt-banner">
              You have an outstanding commission balance of{" "}
              <strong>
                {formatMoney(settlement.commissionDebt, currency)}
              </strong>
              . Please top up your wallet to clear it and continue accepting
              cash bookings.
            </div>
          )}

          <section className="mysettlements-txns">
            <h3 className="mysettlements-section-title">
              Transactions for {MONTHS[month - 1]} {year}
            </h3>
            {!settlement.transactions ||
            settlement.transactions.length === 0 ? (
              <div className="mysettlements-empty">
                No transactions found for this period.
              </div>
            ) : (
              <div className="mysettlements-table-wrap">
                <table className="mysettlements-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th className="ms-amount-col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.transactions
                      .slice()
                      .reverse()
                      .map((txn, idx) => (
                        <tr key={txn._id || idx}>
                          <td>{formatDate(txn.createdAt)}</td>
                          <td>{formatTxnType(txn.type)}</td>
                          <td>{txn.description || "—"}</td>
                          <td
                            className={`ms-amount-col ${
                              txn.amount >= 0 ? "credit" : "debit"
                            }`}
                          >
                            {txn.amount >= 0 ? "+" : "-"}
                            {formatMoney(Math.abs(txn.amount), currency)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default MySettlements;
