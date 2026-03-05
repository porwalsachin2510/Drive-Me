"use client"

import { useState, useEffect, useCallback } from "react"
import B2B_BarChart from "../B2B_Common/B2B_BarChart/B2B_BarChart"
import B2B_LineChart from "../B2B_Common/B2B_LineChart/B2B_LineChart"
import "./b2b_analytics.css"
import api from "../../../utils/api"

function B2B_Analytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("monthly")

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/b2b-partner/analytics', {
        params: { period }
      })
      setAnalytics(response.data.data.analytics)
    } catch (error) {
      console.error("Error fetching analytics data:", error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  if (loading) {
    return (
      <div className="analytics">
        <div className="loading">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="analytics">
        <div className="error">Failed to load analytics data</div>
      </div>
    )
  }

  // Use real chart data from backend analytics
  const revenueChartData = analytics.revenue?.chartData || {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    revenue: [0, 0, 0, 0, 0, 0],
    profit: [0, 0, 0, 0, 0, 0],
  }

  const contractsChartData = analytics.contracts?.chartData || {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    data: [0, 0, 0, 0, 0, 0],
  }

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2 className="section-title">Financial Performance</h2>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="period-selector"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: "#e8f5e9" }}>
            $
          </div>
          <div className="metric-content">
            <p className="metric-label">Total Revenue</p>
            <p className="metric-value">{analytics.revenue?.total?.toLocaleString() || 0} KWD</p>
            <p className="metric-change">{analytics.revenue?.growth || '+0%'}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: "#e3f2fd" }}>
            📈
          </div>
          <div className="metric-content">
            <p className="metric-label">Active Contracts</p>
            <p className="metric-value">{analytics.contracts?.active || 0}</p>
            <p className="metric-change">Total: {analytics.contracts?.total || 0}</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: "#f3e5f5" }}>
            🚌
          </div>
          <div className="metric-content">
            <p className="metric-label">Fleet Utilization</p>
            <p className="metric-value">{analytics.fleet?.utilization || '0%'}</p>
            <p className="metric-change">Active: {analytics.fleet?.activeVehicles || 0}</p>
          </div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-container">
          <h3>Revenue & Profit Trend</h3>
          <B2B_BarChart data={revenueChartData} />
        </div>
        <div className="chart-container">
          <h3>Contracts Trend</h3>
          <B2B_LineChart data={contractsChartData} />
        </div>
      </div>

      <div className="detailed-metrics">
        <h3>Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Total Vehicles</span>
            <span className="metric-value">
              {analytics.fleet?.totalVehicles || 0}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Active Vehicles</span>
            <span className="metric-value">
              {analytics.fleet?.activeVehicles || 0}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Completed Contracts</span>
            <span className="metric-value">
              {analytics.contracts?.completed || 0}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Pending Contracts</span>
            <span className="metric-value">
              {analytics.contracts?.pending || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default B2B_Analytics
