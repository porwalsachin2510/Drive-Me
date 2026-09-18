"use client"

import { useState, useEffect } from "react"
import { Building2, Users, Layers, CheckCircle2 } from "lucide-react"
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
    activeListings: 0,
  })

  const fetchB2BStats = async () => {
    try {
      const response = await api.get("/admin/b2b/stats")
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

  const statChips = [
    { icon: <Building2 size={20} />, value: stats.totalB2BProviders, label: "B2B Providers", tone: "primary" },
    { icon: <CheckCircle2 size={20} />, value: stats.activeB2BProviders, label: "Active B2B", tone: "active" },
    { icon: <Users size={20} />, value: stats.totalB2CProviders, label: "B2C Providers", tone: "primary" },
    { icon: <CheckCircle2 size={20} />, value: stats.activeB2CProviders, label: "Active B2C", tone: "active" },
    { icon: <Layers size={20} />, value: stats.totalListings, label: "Total Listings", tone: "primary" },
    { icon: <CheckCircle2 size={20} />, value: stats.activeListings, label: "Active Listings", tone: "active" },
  ]

  return (
    <div className="admin-b2b-listings">
      <div className="b2b-header">
        <div className="b2b-header-top">
          <div className="b2b-title-section">
            <div className="b2b-header-icon">
              <Building2 size={26} />
            </div>
            <div>
              <h2 className="b2b-title">B2B Listings Management</h2>
              <p className="b2b-description">
                Review, approve and manage fleet providers across your B2B and B2C partner network.
              </p>
            </div>
          </div>
        </div>

        <div className="b2b-stats">
          {statChips.map((chip, i) => (
            <div className="b2b-stat-item" key={i}>
              <div className={`b2b-stat-icon b2b-stat-icon-${chip.tone}`}>{chip.icon}</div>
              <div className="b2b-stat-content">
                <span className="b2b-stat-number">{chip.value}</span>
                <span className="b2b-stat-label">{chip.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="b2b-tabs">
        <button
          className={`b2b-tab ${activeSubTab === "b2b-providers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("b2b-providers")}
        >
          <Building2 size={16} />
          B2B Providers
        </button>
        <button
          className={`b2b-tab ${activeSubTab === "b2c-providers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("b2c-providers")}
        >
          <Users size={16} />
          B2C Providers
        </button>
      </div>

      <div className="b2b-content">{renderSubContent()}</div>
    </div>
  )
}

export default AdminB2BListings
