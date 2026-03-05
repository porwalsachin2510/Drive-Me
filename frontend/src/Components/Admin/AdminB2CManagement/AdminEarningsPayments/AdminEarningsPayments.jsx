"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminEarningsPayments.css"
import api from "../../../../utils/api"

function AdminEarningsPayments() {
  const [earnings, setEarnings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState("monthly")
  const [providerFilter, setProviderFilter] = useState("all")

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/b2c/earnings-payments', {
        params: { 
          period: periodFilter,
          providerId: providerFilter !== "all" ? providerFilter : undefined
        }
      })
      setEarnings(response.data.earnings)
    } catch (error) {
      console.error("Error fetching earnings:", error)
    } finally {
      setLoading(false)
    }
  }, [periodFilter, providerFilter])

  useEffect(() => {
    fetchEarnings()
  }, [fetchEarnings])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KWD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="ad-dash-earnings-payments">
        <div className="loading">Loading earnings data...</div>
      </div>
    )
  }

  if (!earnings) {
    return (
      <div className="ad-dash-earnings-payments">
        <div className="error">Failed to load earnings data</div>
      </div>
    )
  }

  return (
    <div className="ad-dash-earnings-payments">
      <div className="ad-dash-ep-header">
        <div>
          <h3 className="ad-dash-ep-title">Earnings & Payments</h3>
          <p className="ad-dash-ep-subtitle">Track B2C revenue, commissions, and provider payouts.</p>
        </div>
      </div>

      <div className="ad-dash-ep-filters">
        <select 
          value={periodFilter} 
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select 
          value={providerFilter} 
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="all">All Providers</option>
          {earnings.topProviders?.map(provider => (
            <option key={provider.providerId} value={provider.providerId}>
              {provider.providerName}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="ad-dash-ep-summary">
        <div className="summary-card revenue">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <h4>Total Revenue</h4>
            <span className="summary-value">{formatCurrency(earnings.totalRevenue)}</span>
            <span className="summary-change">+12.5% from last period</span>
          </div>
        </div>

        <div className="summary-card bookings">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h4>Total Bookings</h4>
            <span className="summary-value">{earnings.totalBookings.toLocaleString()}</span>
            <span className="summary-change">+8.3% from last period</span>
          </div>
        </div>

        <div className="summary-card commission">
          <div className="summary-icon">💎</div>
          <div className="summary-content">
            <h4>Commission Earned</h4>
            <span className="summary-value">{formatCurrency(earnings.commissionEarned)}</span>
            <span className="summary-change">10% of revenue</span>
          </div>
        </div>

        <div className="summary-card payouts">
          <div className="summary-icon">💸</div>
          <div className="summary-content">
            <h4>Provider Payouts</h4>
            <span className="summary-value">{formatCurrency(earnings.providerPayouts)}</span>
            <span className="summary-change">90% of revenue</span>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="ad-dash-ep-stats">
        <div className="stat-item">
          <span className="stat-label">Average Fare</span>
          <span className="stat-value">{formatCurrency(earnings.averageFare)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Pending Payouts</span>
          <span className="stat-value pending">{formatCurrency(earnings.pendingPayouts)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Completed Payouts</span>
          <span className="stat-value completed">{formatCurrency(earnings.completedPayouts)}</span>
        </div>
      </div>

      {/* Recent Transactions */}
      {earnings.transactions && earnings.transactions.length > 0 && (
        <div className="ad-dash-ep-breakdown">
          <h4>Recent Transactions</h4>
          <div className="breakdown-chart">
            {earnings.transactions.map((txn, index) => (
              <div key={txn._id || index} className="breakdown-item">
                <div className="breakdown-header">
                  <span className="breakdown-period">{txn.providerName || 'Unknown'}</span>
                  <span className="breakdown-revenue">{formatCurrency(txn.amount || 0)}</span>
                </div>
                <div className="breakdown-details">
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{(txn.type || '').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{txn.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date:</span>
                    <span className="detail-value">{txn.date ? formatDate(txn.date) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Providers */}
      <div className="ad-dash-ep-providers">
        <h4>Top Performing Providers</h4>
        <div className="providers-table">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Revenue</th>
                <th>Bookings</th>
                <th>Commission</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {earnings.topProviders?.map((provider, index) => (
                <tr key={provider.providerId}>
                  <td>
                    <div className="provider-info">
                      <span className="provider-rank">#{index + 1}</span>
                      <span className="provider-name">{provider.providerName}</span>
                    </div>
                  </td>
                  <td>{formatCurrency(provider.revenue)}</td>
                  <td>{provider.bookings.toLocaleString()}</td>
                  <td>{formatCurrency(provider.commission)}</td>
                  <td>
                    <div className="performance-bar">
                      <div 
                        className="performance-fill"
                        style={{ 
                          width: `${(provider.revenue / earnings.totalRevenue) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminEarningsPayments
