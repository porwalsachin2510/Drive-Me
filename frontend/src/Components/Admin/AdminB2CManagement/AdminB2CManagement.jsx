"use client"

import { useState, useEffect } from "react"
import "./AdminB2CManagement.css"
import AdminServiceProviders from "./AdminServiceProviders/AdminServiceProviders"
import AdminRouteManagement from "./AdminRouteManagement/AdminRouteManagement"
import AdminTagsBadges from "./AdminTagsBadges/AdminTagsBadges"
import AdminPassengersReassignments from "./AdminPassengersReassignments/AdminPassengersReassignments"
import AdminEarningsPayments from "./AdminEarningsPayments/AdminEarningsPayments"
import api from "../../../utils/api"

function AdminB2CManagement() {
  const [activeSubTab, setActiveSubTab] = useState("service-providers")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalProviders: 0,
    activeProviders: 0,
    totalRoutes: 0,
    activeRoutes: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalPassengerBookings: 0,
    activeTags: 0
  })

  useEffect(() => {
    fetchB2CStats()
  }, [])

  const fetchB2CStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await api.get('/admin/b2c/stats')
      
      if (response.data.success) {
        const data = response.data.stats
        setStats({
          totalProviders: data.providers?.totalProviders || 0,
          activeProviders: data.providers?.activeProviders || 0,
          totalRoutes: data.routes?.totalRoutes || 0,
          activeRoutes: data.routes?.activeRoutes || 0,
          totalBookings: data.bookings?.totalBookings || 0,
          totalRevenue: data.bookings?.totalRevenue || 0,
          totalPassengerBookings: data.passengers?.totalPassengerBookings || 0,
          activeTags: data.tags?.activeTags || 0
        })
      } else {
        throw new Error(response.data.message || 'Failed to fetch B2C stats')
      }
    } catch (error) {
      console.error("Error fetching B2C stats:", error)
      setError(error.message || 'Failed to load B2C statistics')
      // Set fallback data
      setStats({
        totalProviders: 0,
        activeProviders: 0,
        totalRoutes: 0,
        activeRoutes: 0,
        totalBookings: 0,
        totalRevenue: 0,
        totalPassengerBookings: 0,
        activeTags: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const subTabs = [
    { id: "service-providers", label: "🚌 Service Providers", count: stats.activeProviders },
    { id: "route-management", label: "🛣️ Route Management", count: stats.activeRoutes },
    { id: "tags-badges", label: "🏷️ Tags & Badges", count: stats.activeTags },
    { id: "passengers", label: "👥 Passengers & Bookings", count: stats.totalPassengerBookings },
    { id: "earnings", label: "💰 Earnings & Payments", count: null },
  ]

  const renderSubContent = () => {
    switch (activeSubTab) {
      case "service-providers":
        return <AdminServiceProviders />
      case "route-management":
        return <AdminRouteManagement />
      case "tags-badges":
        return <AdminTagsBadges />
      case "passengers":
        return <AdminPassengersReassignments />
      case "earnings":
        return <AdminEarningsPayments />
      default:
        return <AdminServiceProviders />
    }
  }

  if (loading) {
    return (
      <div className="ad-dash-b2c-management">
        <div className="ad-dash-b2c-loading">
          <div className="ad-dash-b2c-loading-spinner"></div>
          <p>Loading B2C Management...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ad-dash-b2c-management">
        <div className="ad-dash-b2c-error">
          <div className="ad-dash-b2c-error-icon">⚠️</div>
          <div className="ad-dash-b2c-error-title">Error Loading Data</div>
          <div className="ad-dash-b2c-error-message">{error}</div>
          <button 
            onClick={fetchB2CStats}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ad-dash-b2c-management">
      <div className="ad-dash-b2c-header">
        <div className="ad-dash-b2c-title-section">
          <h2 className="ad-dash-b2c-title">
            <span className="ad-dash-b2c-icon">🚌</span>
            B2C Management Console
          </h2>
          <p className="ad-dash-b2c-description">
            Comprehensive control over providers, routes, passengers, and B2C financials.
          </p>
        </div>
        
        <div className="ad-dash-b2c-stats">
          <div className="stat-item">
            <div className="stat-icon">👥</div>
            <span className="stat-number">{stats.totalProviders}</span>
            <span className="stat-label">Total Providers</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🛣️</div>
            <span className="stat-number">{stats.activeRoutes}</span>
            <span className="stat-label">Active Routes</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🎫</div>
            <span className="stat-number">{stats.totalBookings.toLocaleString()}</span>
            <span className="stat-label">Total Bookings</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">💰</div>
            <span className="stat-number">{formatCurrency(stats.totalRevenue)}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      <div className="ad-dash-b2c-tabs">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            className={`ad-dash-b2c-tab ${activeSubTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ad-dash-b2c-content">
        {renderSubContent()}
      </div>
    </div>
  )
}

export default AdminB2CManagement
