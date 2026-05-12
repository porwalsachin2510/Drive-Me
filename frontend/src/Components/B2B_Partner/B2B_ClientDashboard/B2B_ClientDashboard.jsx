import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../utils/api';
import './B2B_ClientDashboard.css';

const B2B_ClientDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    overview: {
      totalClients: 0,
      activeContracts: 0,
      totalRevenue: 0,
      monthlyRevenue: 0,
      totalVehicles: 0,
      activeDrivers: 0
    },
    recentContracts: [],
    revenueChart: [],
    clientPerformance: [],
    vehicleUtilization: [],
    upcomingRenewals: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30days');

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get(`/b2b-partner/dashboard`, {
        params: { range: dateRange }
      });
      const data = response.data;

      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError(data.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getUtilizationColor = (percentage) => {
    if (percentage >= 80) return '#ef4444';
    if (percentage >= 60) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div className="drivemego-b2b-client-dashboard">
        <div className="drivemego-loading-container">
          <div className="drivemego-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-b2b-client-dashboard">
      <div className="dashboard-header">
        <h2>B2B Client Dashboard</h2>
        <div className="date-range-selector">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="1year">Last Year</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === "clients" ? "active" : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          Client Performance
        </button>
        <button
          className={`tab-btn ${activeTab === "vehicles" ? "active" : ""}`}
          onClick={() => setActiveTab("vehicles")}
        >
          Vehicle Utilization
        </button>
        <button
          className={`tab-btn ${activeTab === "revenue" ? "active" : ""}`}
          onClick={() => setActiveTab("revenue")}
        >
          Revenue Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === "renewals" ? "active" : ""}`}
          onClick={() => setActiveTab("renewals")}
        >
          Contract Renewals
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === "overview" && (
          <div className="overview-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon clients">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{dashboardData.overview.totalClients}</h3>
                  <p>Total Clients</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon contracts">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{dashboardData.overview.activeContracts}</h3>
                  <p>Active Contracts</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon revenue">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{formatCurrency(dashboardData.overview.totalRevenue)}</h3>
                  <p>Total Revenue</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon monthly">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    ></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>
                    {formatCurrency(dashboardData.overview.monthlyRevenue)}
                  </h3>
                  <p>Monthly Revenue</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon vehicles">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16,8 20,8 23,11 23,16 16,16 16,8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{dashboardData.overview.totalVehicles}</h3>
                  <p>Total Vehicles</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon drivers">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{dashboardData.overview.activeDrivers}</h3>
                  <p>Active Drivers</p>
                </div>
              </div>
            </div>

            <div className="recent-contracts">
              <h3>Recent Contracts</h3>
              <div className="contracts-list">
                {dashboardData.recentContracts.map((contract, index) => (
                  <div key={index} className="contract-item">
                    <div className="contract-info">
                      <h4>{contract.clientName}</h4>
                      <p>{contract.contractType}</p>
                    </div>
                    <div className="contract-details">
                      <span className="contract-value">
                        {formatCurrency(contract.value)}
                      </span>
                      <span className="contract-date">
                        {formatDate(contract.startDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="client-performance-section">
            <h3>Client Performance</h3>
            <div className="client-list">
              {dashboardData.clientPerformance.map((client, index) => (
                <div key={index} className="client-card">
                  <div className="client-header">
                    <h4>{client.clientName}</h4>
                    <span className={`status ${client.status.toLowerCase()}`}>
                      {client.status}
                    </span>
                  </div>
                  <div className="client-metrics">
                    <div className="metric">
                      <label>Employees Transported</label>
                      <span>{client.employeesTransported}</span>
                    </div>
                    <div className="metric">
                      <label>Monthly Revenue</label>
                      <span>{formatCurrency(client.monthlyRevenue)}</span>
                    </div>
                    <div className="metric">
                      <label>Vehicle Utilization</label>
                      <span
                        style={{
                          color: getUtilizationColor(client.utilization),
                        }}
                      >
                        {client.utilization}%
                      </span>
                    </div>
                    <div className="metric">
                      <label>On-Time Performance</label>
                      <span>{client.onTimePerformance}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "vehicles" && (
          <div className="vehicle-utilization-section">
            <h3>Vehicle Utilization</h3>
            <div className="vehicle-grid">
              {dashboardData.vehicleUtilization.map((vehicle, index) => (
                <div key={index} className="vehicle-card">
                  <div className="vehicle-header">
                    <h4>{vehicle.vehicleNumber}</h4>
                    <span className={`status ${vehicle.status.toLowerCase()}`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="vehicle-details">
                    <p>
                      <strong>Type:</strong> {vehicle.type}
                    </p>
                    <p>
                      <strong>Capacity:</strong> {vehicle.capacity} seats
                    </p>
                    <p>
                      <strong>Assigned to:</strong> {vehicle.assignedTo}
                    </p>
                  </div>
                  <div className="utilization-bar">
                    <div className="utilization-label">
                      Utilization: {vehicle.utilization}%
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${vehicle.utilization}%`,
                          backgroundColor: getUtilizationColor(
                            vehicle.utilization,
                          ),
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "revenue" && (
          <div className="revenue-analytics-section">
            <h3>Revenue Analytics</h3>
            <div className="revenue-chart">
              <div className="chart-container">
                {dashboardData.revenueChart.map((item, index) => (
                  <div key={index} className="chart-item">
                    <div className="chart-bar">
                      <div
                        className="bar-fill"
                        style={{
                          height: `${(item.revenue / Math.max(...dashboardData.revenueChart.map((r) => r.revenue))) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="chart-label">{item.period}</div>
                    <div className="chart-value">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "renewals" && (
          <div className="contract-renewals-section">
            <h3>Upcoming Contract Renewals</h3>
            <div className="renewals-list">
              {dashboardData.upcomingRenewals.map((renewal, index) => (
                <div key={index} className="renewal-card">
                  <div className="renewal-info">
                    <h4>{renewal.clientName}</h4>
                    <p>{renewal.contractType}</p>
                  </div>
                  <div className="renewal-details">
                    <span className="renewal-date">
                      Renews: {formatDate(renewal.renewalDate)}
                    </span>
                    <span className="renewal-value">
                      {formatCurrency(renewal.currentValue)}
                    </span>
                    <button className="contact-btn">Contact Client</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default B2B_ClientDashboard;
