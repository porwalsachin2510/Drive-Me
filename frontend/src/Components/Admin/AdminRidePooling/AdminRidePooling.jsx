"use client"

import { useState, useEffect } from "react"
import "./AdminRidePooling.css"
import AdminPassengerInterests from "./AdminPassengerInterests/AdminPassengerInterests"
import AdminUserSuggestedRoutes from "./AdminUserSuggestedRoutes/AdminUserSuggestedRoutes"
import api from "../../../utils/api"

function AdminRidePooling() {
  const [activeSubTab, setActiveSubTab] = useState("passenger-interests")
  const [stats, setStats] = useState({
    totalPassengers: 0,
    activeRoutes: 0,
    suggestedRoutes: 0,
    matchedRides: 0
  })

  const fetchRidePoolingStats = async () => {
    try {
      const response = await api.get('/admin/ride-pooling/stats')
      setStats(response.data.stats)
    } catch (error) {
      console.error("Error fetching ride pooling stats:", error)
    }
  }

  useEffect(() => {
    fetchRidePoolingStats()
  }, [])

  const renderSubContent = () => {
    switch (activeSubTab) {
      case "passenger-interests":
        return <AdminPassengerInterests />
      case "user-suggested-routes":
        return <AdminUserSuggestedRoutes />
      default:
        return <AdminPassengerInterests />
    }
  }

  return (
    <div className="admin-ride-pooling">
      <div className="ride-pooling-header">
        <h2>Ride Pooling Management</h2>
        <div className="ride-pooling-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalPassengers}</span>
            <span className="stat-label">Total Passengers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeRoutes}</span>
            <span className="stat-label">Active Routes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.suggestedRoutes}</span>
            <span className="stat-label">Suggested Routes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.matchedRides}</span>
            <span className="stat-label">Matched Rides</span>
          </div>
        </div>
      </div>

      <div className="ride-pooling-tabs">
        <button
          className={`ride-pooling-tab ${activeSubTab === "passenger-interests" ? "active" : ""}`}
          onClick={() => setActiveSubTab("passenger-interests")}
        >
          Passenger Interests
        </button>
        <button
          className={`ride-pooling-tab ${activeSubTab === "user-suggested-routes" ? "active" : ""}`}
          onClick={() => setActiveSubTab("user-suggested-routes")}
        >
          User Suggested Routes
        </button>
      </div>

      <div className="ride-pooling-content">
        {renderSubContent()}
      </div>
    </div>
  )
}

export default AdminRidePooling
