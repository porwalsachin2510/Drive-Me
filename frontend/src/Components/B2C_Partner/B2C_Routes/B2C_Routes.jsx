"use client"

import { useState, useEffect } from "react"
import B2C_RoutesTab from "../B2C_RoutesSub/B2C_RoutesTab/B2C_RoutesTab"
import B2C_AddRouteModal from "../B2C_RoutesSub/B2C_AddRouteModal/B2C_AddRouteModal"
import B2C_ScheduleModal from "../B2C_RoutesSub/B2C_ScheduleModal/B2C_ScheduleModal"
import "./b2c_routes.css"
import api from "../../../utils/api"

function B2C_Routes() {
  const [showAddRouteModal, setShowAddRouteModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      setLoading(true)
      const response = await api.get('/b2c-schedules/routes')
      setRoutes(response.data.routes || [])
    } catch (error) {
      console.error("Error fetching routes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRoute = async (routeData) => {
    try {
      await api.post('/b2c-schedules/routes', routeData)
      setShowAddRouteModal(false)
      fetchRoutes()
    } catch (error) {
      console.error("Error adding route:", error)
    }
  }

  const handleOpenScheduleModal = (route) => {
    setSelectedRoute(route)
    setShowScheduleModal(true)
  }

  const handleScheduleCreated = () => {
    fetchRoutes()
    setShowScheduleModal(false)
    setSelectedRoute(null)
  }

  if (loading) {
    return (
      <div className="b2c-routes-container">
        <div className="b2c-loading-container">
          <div className="b2c-loading-spinner"></div>
          <p className="b2c-loading-text">Loading routes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="b2c-routes-container">
      <div className="b2c-routes-header">
        <div className="b2c-routes-title-section">
          <h2 className="b2c-routes-title">Route Management</h2>
          <p className="b2c-routes-subtitle">Manage your public transport routes and schedules</p>
        </div>
        <div className="b2c-routes-actions">
          <div className="b2c-route-stats">
            <div className="b2c-stat-item">
              <span className="b2c-stat-label">Total Routes</span>
              <span className="b2c-stat-value">{routes.length}</span>
            </div>
            <div className="b2c-stat-item">
              <span className="b2c-stat-label">Active</span>
              <span className="b2c-stat-value">{routes.filter(r => r.status === 'Active').length}</span>
            </div>
          </div>
          <button
            className="b2c-add-route-btn"
            onClick={() => setShowAddRouteModal(true)}
          >
            <span className="b2c-btn-icon">+</span>
            <span className="b2c-btn-text">Add New Route</span>
          </button>
        </div>
      </div>

      <div className="b2c-routes-content">
        <B2C_RoutesTab 
          routes={routes} 
          onRefresh={fetchRoutes}
          onAddSchedule={handleOpenScheduleModal}
        />
      </div>

      {showAddRouteModal && (
        <B2C_AddRouteModal 
          onClose={() => setShowAddRouteModal(false)}
        />
      )}

      {showScheduleModal && selectedRoute && (
        <B2C_ScheduleModal 
          route={selectedRoute}
          onClose={() => setShowScheduleModal(false)}
          onScheduleCreated={handleScheduleCreated}
        />
      )}
    </div>
  )
}

export default B2C_Routes
