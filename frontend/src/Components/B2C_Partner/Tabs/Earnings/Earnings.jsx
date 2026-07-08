"use client";

import { useState, useEffect, useCallback } from "react";
import "./earnings.css";
import api from "../../../../utils/api";
import { useAutoRefresh } from "../../../../hooks/useAutoRefresh";

function Earnings() {
  const [earningsData, setEarningsData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  const fetchEarningsData = useCallback(
    async ({ silent } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await api.get("/b2c-partner/earnings", {
          params: { period },
        });
        setEarningsData(response.data.earnings);
        setTransactions(response.data.transactions || []);
      } catch (error) {
        console.error("Error fetching earnings data:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  // Live auto-refresh: earnings update as trips complete / payments settle.
  useAutoRefresh(fetchEarningsData, {
    interval: 30000,
    socketEvents: ["trip-completed", "wallet-activity", "new-notification"],
    deps: [period],
  });

  if (loading) {
    return (
      <div className="earnings">
        <div className="loading">Loading earnings...</div>
      </div>
    );
  }

  if (!earningsData) {
    return (
      <div className="earnings">
        <div className="error">Failed to load earnings data</div>
      </div>
    );
  }

  return (
    <div className="earnings">
      <div className="earnings-header">
        <h2>Earnings Overview</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="period-selector"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="earnings-cards">
        <div className="earnings-card total">
          <div className="card-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M8 4V8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M8 8H11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Net Earnings
          </div>
          <div className="card-value">
            {earningsData.totalNet || earningsData.total}
          </div>
          <div className="card-breakdown">
            <div className="breakdown-row">
              <span className="breakdown-label">Total Payments</span>
              <span className="breakdown-value">{earningsData.totalGross}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-label">Admin Commission</span>
              <span className="breakdown-value deduction">
                - {earningsData.totalCommission}
              </span>
            </div>
          </div>
        </div>

        <div className="earnings-card week">
          <div className="card-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8H14M2 8L6 4M2 8L6 12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 8H2M14 8L10 4M14 8L10 12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            This Week
          </div>
          <div className="card-value">
            {earningsData.thisWeekNet || earningsData.thisWeek}
          </div>
          <div className="card-change positive">
            {earningsData.thisWeekChange}
          </div>
          <div className="card-breakdown">
            <div className="breakdown-row">
              <span className="breakdown-label">Payments</span>
              <span className="breakdown-value">
                {earningsData.thisWeekGross}
              </span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-label">Commission</span>
              <span className="breakdown-value deduction">
                - {earningsData.thisWeekCommission}
              </span>
            </div>
          </div>
        </div>

        <div className="earnings-card today">
          <div className="card-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M8 5V8L10 10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Today
          </div>
          <div className="card-value">
            {earningsData.todayNet || earningsData.today}
          </div>
          <div className="card-breakdown">
            <div className="breakdown-row">
              <span className="breakdown-label">Payments</span>
              <span className="breakdown-value">{earningsData.todayGross}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-label">Commission</span>
              <span className="breakdown-value deduction">
                - {earningsData.todayCommission}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="transactions-section">
        <h3>Transaction History</h3>
        <div className="transactions-list">
          {transactions.length > 0 && (
            <div className="transaction-item transaction-head">
              <div className="transaction-date">Date</div>
              <div className="transaction-col">Trips</div>
              <div className="transaction-col">Total Payment</div>
              <div className="transaction-col">Admin Commission</div>
              <div className="transaction-col">Net Earnings</div>
              <div className="transaction-col">Status</div>
            </div>
          )}
          {transactions.map((transaction, index) => (
            <div key={index} className="transaction-item">
              <div className="transaction-date">{transaction.date}</div>
              <div className="transaction-col">{transaction.trips} trips</div>
              <div className="transaction-col gross">
                {transaction.grossAmount}
              </div>
              <div className="transaction-col commission">
                - {transaction.commissionAmount}
              </div>
              <div className="transaction-col net">
                {transaction.netAmount || transaction.amount}
              </div>
              <div
                className={`transaction-col transaction-status ${transaction.status.toLowerCase()}`}
              >
                {transaction.status}
              </div>
            </div>
          ))}
        </div>

        {transactions.length === 0 && (
          <div className="no-transactions">
            <p>No transactions found for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Earnings;
