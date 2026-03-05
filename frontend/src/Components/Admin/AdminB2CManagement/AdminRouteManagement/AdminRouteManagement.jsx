"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminRouteManagement.css"
import api from "../../../../utils/api"

function AdminRouteManagement() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [stats, setStats] = useState({
    totalRoutes: 0,
    activeRoutes: 0,
    inactiveRoutes: 0,
    maintenanceRoutes: 0
  })
  const [notification, setNotification] = useState(null)

  const fetchRouteStats = useCallback(async (routeData) => {
    try {
      const response = await api.get('/admin/b2c/stats')
      
      if (response.data.success && response.data.stats) {
        const data = response.data.stats.routes || {}
        setStats({
          totalRoutes: data.totalRoutes || 0,
          activeRoutes: data.activeRoutes || 0,
          inactiveRoutes: data.inactiveRoutes || 0,
          maintenanceRoutes: data.maintenanceRoutes || 0
        })
      }
    } catch (error) {
      console.error("Error fetching route stats:", error)
      
      // Fallback: Calculate stats from current routes data
      const currentRoutes = routeData || routes
      if (currentRoutes.length > 0) {
        const calculatedStats = currentRoutes.reduce((acc, route) => {
          acc.totalRoutes++
          if (route.status === 'Active' || route.status === 'active') acc.activeRoutes++
          else if (route.status === 'Inactive' || route.status === 'inactive') acc.inactiveRoutes++
          else if (route.status === 'Scheduled' || route.status === 'maintenance') acc.maintenanceRoutes++
          return acc
        }, { totalRoutes: 0, activeRoutes: 0, inactiveRoutes: 0, maintenanceRoutes: 0 })
        
        setStats(calculatedStats)
      }
    }
  }, []) // removed routes dependency to prevent loop

  const fetchRoutes = useCallback(async (isInitial = false) => {
    try {
      // Only show loading spinner on the very first load
      if (isInitial) {
        setLoading(true)
      }
      const response = await api.get('/admin/b2c/routes', {
        params: { status: statusFilter !== "all" ? statusFilter : undefined }
      })
      
      if (response.data.success) {
        const routeData = response.data.routes || []
        setRoutes(routeData)
        await fetchRouteStats(routeData)
      }
    } catch (error) {
      console.error("Error fetching routes:", error)
      if (isInitial) {
        setRoutes([])
      }
    } finally {
      if (isInitial) {
        setLoading(false)
        setInitialLoad(false)
      }
    }
  }, [statusFilter, fetchRouteStats])

  useEffect(() => {
    fetchRoutes(initialLoad)
  }, [fetchRoutes])

  const handleEditClick = (route) => {
    // Admin can only view route details, not edit
    setNotification({ 
      type: 'info', 
      message: 'Route details view only. B2C Partner manages their own routes.' 
    })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleSuspendRoute = async (routeId, action) => {
    try {
      setNotification({ type: 'info', message: `${action === 'suspend' ? 'Suspending' : 'Activating'} route...` })
      
      const response = await api.put(`/admin/b2c/routes/${routeId}/${action}`)
      
      if (response.data.success) {
        setNotification({ type: 'success', message: `Route ${action}d successfully!` })
        await fetchRoutes()
      } else {
        throw new Error(response.data.message || `Failed to ${action} route`)
      }
    } catch (error) {
      console.error(`Error ${action}ing route:`, error)
      setNotification({ type: 'error', message: error.message || `Failed to ${action} route` })
    } finally {
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleDeleteRoute = async (routeId) => {
    if (window.confirm("Are you sure you want to delete this route?")) {
      try {
        setNotification({ type: 'info', message: 'Deleting route...' })
        const response = await api.delete(`/admin/b2c/routes/${routeId}`)
        
        if (response.data.success) {
          setNotification({ type: 'success', message: 'Route deleted successfully!' })
          await Promise.all([fetchRoutes(), fetchRouteStats()])
        } else {
          throw new Error(response.data.message || 'Failed to delete route')
        }
      } catch (error) {
        console.error("Error deleting route:", error)
        setNotification({ type: 'error', message: error.message || 'Failed to delete route' })
      } finally {
        setTimeout(() => setNotification(null), 3000)
      }
    }
  }

  const handleToggleStatus = async (routeId, currentStatus) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      setNotification({ type: 'info', message: `Updating route status to ${newStatus}...` })
      const response = await api.put(`/admin/b2c/routes/${routeId}`, { status: newStatus })
      
      if (response.data.success) {
        setNotification({ type: 'success', message: `Route ${newStatus} successfully!` })
        await Promise.all([fetchRoutes(), fetchRouteStats()])
      } else {
        throw new Error(response.data.message || 'Failed to update route status')
      }
    } catch (error) {
      console.error("Error updating route status:", error)
      setNotification({ type: 'error', message: error.message || 'Failed to update route status' })
    } finally {
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleToggleFeatured = async (routeId, currentFeatured) => {
    try {
      setNotification({ type: 'info', message: 'Updating featured status...' })
      const response = await api.put(`/admin/b2c/routes/${routeId}`, { featured: !currentFeatured })
      
      if (response.data.success) {
        setNotification({ 
          type: 'success', 
          message: `Route ${!currentFeatured ? 'featured' : 'unfeatured'} successfully!` 
        })
        await Promise.all([fetchRoutes(), fetchRouteStats()])
      } else {
        throw new Error(response.data.message || 'Failed to update featured status')
      }
    } catch (error) {
      console.error("Error updating featured status:", error)
      setNotification({ type: 'error', message: error.message || 'Failed to update featured status' })
    } finally {
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const filteredRoutes = routes.filter(route => 
    route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.startPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.endPoint.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "#28a745"
      case "inactive": return "#dc3545"
      case "pending": return "#ffc107"
      default: return "#6c757d"
    }
  }

  if (loading) {
    return (
      <div className="route-management-container">
        <div className="route-management-loading">
          <div className="route-management-spinner"></div>
          <p>Loading routes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="route-management-container">
      {/* Notification */}
      {notification && (
        <div className={`route-management-notification route-management-notification-${notification.type}`}>
          <span className="route-management-notification-icon">
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : '⏳'}
          </span>
          <span className="route-management-notification-message">
            {notification.message}
          </span>
        </div>
      )}

      <div className="route-management-header">
        <div className="route-management-title-section">
          <h3 className="route-management-title">
            <span className="route-management-icon">🚌</span>
            B2C Route Management
          </h3>
          <p className="route-management-description">
            Manage and monitor all B2C transportation routes and schedules
          </p>
        </div>
        
        <div className="route-management-stats">
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon">🛣️</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">{stats.totalRoutes}</span>
              <span className="route-management-stat-label">Total Routes</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon">✅</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">{stats.activeRoutes}</span>
              <span className="route-management-stat-label">Active</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon">⏸️</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">{stats.inactiveRoutes}</span>
              <span className="route-management-stat-label">Inactive</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon">🔧</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">{stats.maintenanceRoutes}</span>
              <span className="route-management-stat-label">Maintenance</span>
            </div>
          </div>
        </div>
      
      </div>

      <div className="route-management-controls">
        <div className="route-management-search">
          <div className="route-management-search-container">
            <span className="route-management-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search routes by name, provider, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="route-management-search-input"
            />
          </div>
        </div>
        
        <div className="route-management-filters">
          <select 
            className="route-management-filter-select"
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      <div className="route-management-content">
        <div className="route-management-grid">
          {filteredRoutes.map((route) => (
            <div key={route._id} className="route-management-card">
              <div className="route-management-card-header">
                <div className="route-management-title-section">
                  <h4 className="route-management-route-name">{route.name}</h4>
                  {route.featured && (
                    <span className="route-management-featured-badge">⭐ Featured</span>
                  )}
                </div>
                <div className="route-management-status-badge">
                  <span className={`route-management-status route-management-status-${route.status.toLowerCase()}`}>
                    {route.status}
                  </span>
                </div>
              </div>
              
              <div className="route-management-card-content">
                <div className="route-management-provider">
                  <span className="route-management-provider-label">Provider:</span>
                  <span className="route-management-provider-name">{route.providerName}</span>
                </div>
                
                <div className="route-management-path">
                  <div className="route-management-point">
                    <span className="route-management-point-icon">📍</span>
                    <span className="route-management-point-text">{route.startPoint}</span>
                  </div>
                  <div className="route-management-arrow">→</div>
                  <div className="route-management-point">
                    <span className="route-management-point-icon">🎯</span>
                    <span className="route-management-point-text">{route.endPoint}</span>
                  </div>
                </div>
                
                <div className="route-management-details">
                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">⏰</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">Time</span>
                      <span className="route-management-detail-value">{route.departureTime} - {route.arrivalTime}</span>
                    </div>
                  </div>
                  
                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">💺</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">Capacity</span>
                      <span className="route-management-detail-value">{route.bookedSeats}/{route.capacity}</span>
                    </div>
                  </div>
                  
                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">💰</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">Price</span>
                      <span className="route-management-detail-value">AED {route.price.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">📏</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">Distance</span>
                      <span className="route-management-detail-value">{route.distance}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="route-management-card-actions">
                <button 
                  className="route-management-action-btn route-management-edit-btn"
                  onClick={() => handleEditClick(route)}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="route-management-action-btn route-management-status-btn"
                  onClick={() => handleToggleStatus(route._id, route.status)}
                >
                  {route.status === 'active' ? '⏸️ Deactivate' : '✅ Activate'}
                </button>
                <button 
                  className="route-management-action-btn route-management-featured-btn"
                  onClick={() => handleToggleFeatured(route._id, route.featured)}
                >
                  {route.featured ? '⭐ Unfeature' : '☆ Feature'}
                </button>
                <button 
                  className="route-management-action-btn route-management-delete-btn"
                  onClick={() => handleDeleteRoute(route._id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="route-management-empty">
          <div className="route-management-empty-icon">🔍</div>
          <h3>No Routes Found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  )
}

export default AdminRouteManagement
