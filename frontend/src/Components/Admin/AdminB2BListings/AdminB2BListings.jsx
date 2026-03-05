"use client"

import { useState, useEffect } from "react"
import "./AdminB2BListings.css"
import AdminB2BProviders from "./AdminB2BProviders/AdminB2BProviders"
import AdminB2CProviders from "./AdminB2CProviders/AdminB2CProviders"
import api from "../../../utils/api"

function AdminB2BListings() {
  const [activeSubTab, setActiveSubTab] = useState("b2b-providers")
  const [stats, setStats] = useState({
    totalB2BProviders: 0,
    activeB2BProviders: 0,
    totalB2CProviders: 0,
    activeB2CProviders: 0,
    totalListings: 0,
    activeListings: 0
  })

  const fetchB2BStats = async () => {
    try {
      const response = await api.get('/admin/b2b/stats')
      setStats(response.data.stats)
    } catch (error) {
      console.error("Error fetching B2B stats:", error)
    }
  }

  useEffect(() => {
    fetchB2BStats()
  }, [])

  const renderSubContent = () => {
    switch (activeSubTab) {
      case "b2b-providers":
        return <AdminB2BProviders />
      case "b2c-providers":
        return <AdminB2CProviders />
      default:
        return <AdminB2BProviders />
    }
  }

  return (
    <div className="admin-b2b-listings">
      <div className="b2b-header">
        <h2>B2B Listings Management</h2>
        <div className="b2b-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalB2BProviders}</span>
            <span className="stat-label">B2B Providers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeB2BProviders}</span>
            <span className="stat-label">Active B2B</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalB2CProviders}</span>
            <span className="stat-label">B2C Providers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeB2CProviders}</span>
            <span className="stat-label">Active B2C</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalListings}</span>
            <span className="stat-label">Total Listings</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeListings}</span>
            <span className="stat-label">Active Listings</span>
          </div>
        </div>
      </div>

      <div className="b2b-tabs">
        <button
          className={`b2b-tab ${activeSubTab === "b2b-providers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("b2b-providers")}
        >
          B2B Providers
        </button>
        <button
          className={`b2b-tab ${activeSubTab === "b2c-providers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("b2c-providers")}
        >
          B2C Providers
        </button>
      </div>

      <div className="b2b-content">
        {renderSubContent()}
      </div>
    </div>
  )
}

export default AdminB2BListings
