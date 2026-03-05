"use client"

import { useState, useEffect } from "react"
import "./AdminFinance.css"
import api from "../../../utils/api"

function AdminFinance() {
  const [activeTab, setActiveTab] = useState("payout")
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    netEarnings: 0,
    pendingPayouts: 0,
    activeProviders: 0,
    totalTransactions: 0,
    monthlyRevenue: 0,
    commissionEarned: 0,
    securityDeposits: 0
  })
  const [payoutRequests, setPayoutRequests] = useState([])
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    fetchFinanceData()
  }, [])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Fetch metrics
      const metricsResponse = await api.get('/admin/finance/metrics')
      setMetrics(metricsResponse.data.metrics)

      // Fetch payout requests
      const payoutsResponse = await api.get('/admin/finance/payouts')
      setPayoutRequests(payoutsResponse.data.payouts)

      // Fetch transactions
      const transactionsResponse = await api.get('/admin/finance/transactions')
      setTransactions(transactionsResponse.data.transactions)
      
    } catch (error) {
      console.error("Error fetching finance data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayoutAction = async (payoutId, action) => {
    try {
      await api.put(`/admin/finance/payouts/${payoutId}/${action}`)
      fetchFinanceData()
    } catch (error) {
      console.error(`Error ${action} payout:`, error)
    }
  }

  const formatCurrency = (amount, currency = 'KWD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING": return "#ffc107"
      case "APPROVED": return "#28a745"
      case "REJECTED": return "#dc3545"
      case "COMPLETED": return "#17a2b8"
      default: return "#6c757d"
    }
  }

  const renderPayouts = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Payout Requests</h3>
        <div className="payout-stats">
          <div className="stat-card">
            <span className="stat-number">{payoutRequests.length}</span>
            <span className="stat-label">Total Requests</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{payoutRequests.filter(p => p.status === 'PENDING').length}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
      </div>

      <div className="payouts-table">
        <table>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Provider</th>
              <th>Type</th>
              <th>Total Amount</th>
              <th>Commission</th>
              <th>Net Payable</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payoutRequests.map(payout => (
              <tr key={payout._id}>
                <td>{payout._id}</td>
                <td>{payout.providerId?.fullName || payout.providerId?.companyName}</td>
                <td>{payout.type}</td>
                <td>{formatCurrency(payout.totalAmount)}</td>
                <td>-{formatCurrency(payout.commissionAmount)}</td>
                <td className="net-payable">{formatCurrency(payout.netPayable)}</td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(payout.status) }}
                  >
                    {payout.status}
                  </span>
                </td>
                <td>
                  {payout.status === 'PENDING' && (
                    <>
                      <button 
                        className="approve-btn"
                        onClick={() => handlePayoutAction(payout._id, 'approve')}
                      >
                        Approve
                      </button>
                      <button 
                        className="reject-btn"
                        onClick={() => handlePayoutAction(payout._id, 'reject')}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {payout.status === 'APPROVED' && (
                    <button 
                      className="complete-btn"
                      onClick={() => handlePayoutAction(payout._id, 'complete')}
                    >
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderTransactions = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Transaction History</h3>
        <div className="transaction-stats">
          <div className="stat-card">
            <span className="stat-number">{transactions.length}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{formatCurrency(metrics.totalRevenue)}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      <div className="transactions-table">
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction._id}>
                <td>{transaction._id}</td>
                <td>{new Date(transaction.createdAt).toLocaleDateString()}</td>
                <td>{transaction.type}</td>
                <td>{transaction.from}</td>
                <td>{transaction.to}</td>
                <td>{formatCurrency(transaction.amount)}</td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(transaction.status) }}
                  >
                    {transaction.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderMetrics = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Financial Metrics</h3>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h4>Total Revenue</h4>
          <span className="metric-value">{formatCurrency(metrics.totalRevenue)}</span>
          <div className="metric-change positive">+12.5%</div>
        </div>
        <div className="metric-card">
          <h4>Net Earnings</h4>
          <span className="metric-value">{formatCurrency(metrics.netEarnings)}</span>
          <div className="metric-change positive">+8.3%</div>
        </div>
        <div className="metric-card">
          <h4>Commission Earned</h4>
          <span className="metric-value">{formatCurrency(metrics.commissionEarned)}</span>
          <div className="metric-change positive">+15.2%</div>
        </div>
        <div className="metric-card">
          <h4>Security Deposits</h4>
          <span className="metric-value">{formatCurrency(metrics.securityDeposits)}</span>
          <div className="metric-change neutral">0%</div>
        </div>
        <div className="metric-card">
          <h4>Monthly Revenue</h4>
          <span className="metric-value">{formatCurrency(metrics.monthlyRevenue)}</span>
          <div className="metric-change positive">+5.7%</div>
        </div>
        <div className="metric-card">
          <h4>Active Providers</h4>
          <span className="metric-value">{metrics.activeProviders}</span>
          <div className="metric-change positive">+2</div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case "payout":
        return renderPayouts()
      case "transactions":
        return renderTransactions()
      case "metrics":
        return renderMetrics()
      default:
        return renderPayouts()
    }
  }

  if (loading) {
    return (
      <div className="admin-finance">
        <div className="loading">Loading financial data...</div>
      </div>
    )
  }

  return (
    <div className="admin-finance">
      <div className="finance-header">
        <h2>Finance Management</h2>
        <div className="finance-overview">
          <div className="overview-item">
            <span className="overview-label">Total Revenue</span>
            <span className="overview-value">{formatCurrency(metrics.totalRevenue)}</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Net Earnings</span>
            <span className="overview-value">{formatCurrency(metrics.netEarnings)}</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Pending Payouts</span>
            <span className="overview-value">{formatCurrency(metrics.pendingPayouts)}</span>
          </div>
        </div>
      </div>

      <div className="finance-tabs">
        <button
          className={`finance-tab ${activeTab === "payout" ? "active" : ""}`}
          onClick={() => setActiveTab("payout")}
        >
          Payouts
        </button>
        <button
          className={`finance-tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={`finance-tab ${activeTab === "metrics" ? "active" : ""}`}
          onClick={() => setActiveTab("metrics")}
        >
          Metrics
        </button>
      </div>

      <div className="finance-content">
        {renderContent()}
      </div>
    </div>
  )
}

export default AdminFinance
