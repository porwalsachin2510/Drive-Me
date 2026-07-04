"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import B2B_BarChart from "../B2B_Common/B2B_BarChart/B2B_BarChart";
import B2B_LineChart from "../B2B_Common/B2B_LineChart/B2B_LineChart";
import "./b2b_analytics.css";
import api from "../../../utils/api";

function B2B_Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2b-partner/analytics", {
        params: { period },
      });
      setAnalytics(response.data.data.analytics);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (loading) {
    return (
      <div className="drivemego-b2b_analytics-analytics">
        <div className="drivemego-b2b_analytics-loading">
          Loading analytics...
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="drivemego-b2b_analytics-analytics">
        <div className="drivemego-b2b_analytics-error">
          Failed to load analytics data
        </div>
      </div>
    );
  }

  const currency = analytics.revenue?.currency || getActiveCurrency();

  // Use real chart data from backend analytics
  const revenueChartData = analytics.revenue?.chartData || {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    revenue: [0, 0, 0, 0, 0, 0],
    profit: [0, 0, 0, 0, 0, 0],
  };

  const contractsChartData = analytics.contracts?.chartData || {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    data: [0, 0, 0, 0, 0, 0],
  };

  return (
    <div className="drivemego-b2b_analytics-analytics">
      <div className="drivemego-b2b_analytics-analytics-header">
        <h2 className="drivemego-b2b_analytics-section-title">
          Financial Performance
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="drivemego-b2b_analytics-period-selector"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="drivemego-b2b_analytics-metric-cards">
        <div className="drivemego-b2b_analytics-metric-card">
          <div
            className="drivemego-b2b_analytics-metric-icon"
            style={{ backgroundColor: "#e8f5e9" }}
          >
            📈
          </div>
          <div className="drivemego-b2b_analytics-metric-content">
            <p className="drivemego-b2b_analytics-metric-label">
              Total Revenue
            </p>
            <p className="drivemego-b2b_analytics-metric-value">
              {analytics.revenue?.total?.toLocaleString() || 0} {currency}
            </p>
            <p className="drivemego-b2b_analytics-metric-change">
              {analytics.revenue?.growth || "+0%"}
            </p>
          </div>
        </div>
        <div className="drivemego-b2b_analytics-metric-card">
          <div
            className="drivemego-b2b_analytics-metric-icon"
            style={{ backgroundColor: "#e3f2fd" }}
          >
            📈
          </div>
          <div className="drivemego-b2b_analytics-metric-content">
            <p className="drivemego-b2b_analytics-metric-label">
              Active Contracts
            </p>
            <p className="drivemego-b2b_analytics-metric-value">
              {analytics.contracts?.active || 0}
            </p>
            <p className="drivemego-b2b_analytics-metric-change">
              Total: {analytics.contracts?.total || 0}
            </p>
          </div>
        </div>
        <div className="drivemego-b2b_analytics-metric-card">
          <div
            className="drivemego-b2b_analytics-metric-icon"
            style={{ backgroundColor: "#f3e5f5" }}
          >
            🚌
          </div>
          <div className="drivemego-b2b_analytics-metric-content">
            <p className="drivemego-b2b_analytics-metric-label">
              Fleet Utilization
            </p>
            <p className="drivemego-b2b_analytics-metric-value">
              {analytics.fleet?.utilization || "0%"}
            </p>
            <p className="drivemego-b2b_analytics-metric-change">
              Active: {analytics.fleet?.activeVehicles || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="drivemego-b2b_analytics-charts-section">
        <div className="drivemego-b2b_analytics-chart-container">
          <h3>Revenue & Profit Trend</h3>
          <B2B_BarChart data={revenueChartData} currency={currency} />
        </div>
        <div className="drivemego-b2b_analytics-chart-container">
          <h3>Contracts Trend</h3>
          <B2B_LineChart data={contractsChartData} currency={currency} />
        </div>
      </div>

      <div className="drivemego-b2b_analytics-detailed-metrics">
        <h3>Performance Metrics</h3>
        <div className="drivemego-b2b_analytics-metrics-grid">
          <div className="drivemego-b2b_analytics-metric-item">
            <span className="drivemego-b2b_analytics-metric-label">
              Total Vehicles
            </span>
            <span className="drivemego-b2b_analytics-metric-value">
              {analytics.fleet?.totalVehicles || 0}
            </span>
          </div>
          <div className="drivemego-b2b_analytics-metric-item">
            <span className="drivemego-b2b_analytics-metric-label">
              Active Vehicles
            </span>
            <span className="drivemego-b2b_analytics-metric-value">
              {analytics.fleet?.activeVehicles || 0}
            </span>
          </div>
          <div className="drivemego-b2b_analytics-metric-item">
            <span className="drivemego-b2b_analytics-metric-label">
              Completed Contracts
            </span>
            <span className="drivemego-b2b_analytics-metric-value">
              {analytics.contracts?.completed || 0}
            </span>
          </div>
          <div className="drivemego-b2b_analytics-metric-item">
            <span className="drivemego-b2b_analytics-metric-label">
              Pending Contracts
            </span>
            <span className="drivemego-b2b_analytics-metric-value">
              {analytics.contracts?.pending || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default B2B_Analytics;
