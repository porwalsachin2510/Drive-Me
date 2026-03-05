"use client"

import { useState, useEffect } from "react"
import "./AdminServiceProviders.css"
import api from "../../../../utils/api"

function AdminServiceProviders() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [stats, setStats] = useState({
    totalProviders: 0,
    activeProviders: 0,
    suspendedProviders: 0,
    pendingProviders: 0
  })

  useEffect(() => {
    fetchProviders()
    fetchProviderStats()
  }, [])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      // Fetch B2C stats
      await api.get('/admin/b2c/stats')
      
      // Get real B2C providers data
      const providersResponse = await api.get('/admin/users?role=B2C_PARTNER')
      
      if (providersResponse.data.success) {
        setProviders(providersResponse.data.users || [])
      }
    } catch (error) {
      console.error("Error fetching B2C providers:", error)
      setProviders([])
    } finally {
      setLoading(false)
    }
  }

  const fetchProviderStats = async () => {
    try {
      const response = await api.get('/admin/b2c/stats')
      
      console.log('B2C Stats Response:', response.data) // Debug log
      
      if (response.data.success && response.data.stats) {
        const data = response.data.stats.providers || {}
        console.log('Provider Stats Data:', data) // Debug log
        
        setStats({
          totalProviders: data.totalProviders || 0,
          activeProviders: data.activeProviders || 0,
          suspendedProviders: data.suspendedProviders || 0,
          pendingProviders: data.pendingProviders || 0
        })
      } else {
        console.warn('Unexpected response structure:', response.data)
        // Set fallback values
        setStats({
          totalProviders: 0,
          activeProviders: 0,
          suspendedProviders: 0,
          pendingProviders: 0
        })
      }
    } catch (error) {
      console.error("Error fetching provider stats:", error)
      // Set fallback values on error
      setStats({
        totalProviders: 0,
        activeProviders: 0,
        suspendedProviders: 0,
        pendingProviders: 0
      })
    }
  }

  const handleProviderAction = async (providerId, action) => {
    try {
      setActionLoading(true)
      const endpoint = action === 'suspend' ? 'suspend' : 'activate'
      const response = await api.put(`/admin/providers/b2c/${providerId}/${endpoint}`)
      
      if (response.data.success) {
        setNotification({
          type: 'success',
          message: `Provider ${action}d successfully!`
        })
        // Refresh both providers and stats
        await Promise.all([
          fetchProviders(),
          fetchProviderStats()
        ])
      } else {
        throw new Error(response.data.message || `Failed to ${action} provider`)
      }
    } catch (error) {
      console.error(`Error ${action} provider:`, error)
      setNotification({
        type: 'error',
        message: error.message || `Failed to ${action} provider`
      })
    } finally {
      setActionLoading(false)
      // Hide notification after 3 seconds
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleViewDetails = (provider) => {
    setSelectedProvider(provider)
    setShowDetailsModal(true)
  }

  const handleCloseModal = () => {
    setShowDetailsModal(false)
    setSelectedProvider(null)
  }

  const filteredProviders = providers.filter(provider => {
    const matchesSearch = provider.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || (provider.status || 'PENDING') === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const _getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE": return "#28a745"
      case "SUSPENDED": return "#dc3545"
      case "PENDING": return "#ffc107"
      default: return "#6c757d"
    }
  }

  const getInitial = (name) => {
    return name && name.trim() ? name.charAt(0).toUpperCase() : "P"
  }

  if (loading) {
    return (
      <div className="service-providers-container">
        <div className="service-providers-loading">
          <div className="service-providers-spinner"></div>
          <p>Loading service providers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="service-providers-container">
      {/* Notification */}
      {notification && (
        <div className={`service-providers-notification service-providers-notification-${notification.type}`}>
          <span className="service-providers-notification-icon">
            {notification.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="service-providers-notification-message">
            {notification.message}
          </span>
        </div>
      )}

      <div className="service-providers-header">
        <div className="service-providers-title-section">
          <h3 className="service-providers-title">
            <span className="service-providers-icon">🚌</span>
            B2C Service Providers
          </h3>
          <p className="service-providers-description">
            Manage and monitor all B2C transport service providers
          </p>
        </div>
        
        <div className="service-providers-stats">
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon">👥</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">{stats.totalProviders}</span>
              <span className="service-providers-stat-label">Total</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon">✅</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">{stats.activeProviders}</span>
              <span className="service-providers-stat-label">Active</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon">⏸️</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">{stats.suspendedProviders}</span>
              <span className="service-providers-stat-label">Suspended</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon">⏳</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">{stats.pendingProviders}</span>
              <span className="service-providers-stat-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="service-providers-controls">
        <div className="service-providers-search">
          <div className="service-providers-search-container">
            <span className="service-providers-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search providers by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="service-providers-search-input"
            />
          </div>
        </div>
        
        <div className="service-providers-filters">
          <button
            className={`service-providers-filter-btn ${statusFilter === "all" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            📋 All Providers
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "ACTIVE" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("ACTIVE")}
          >
            ✅ Active
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "SUSPENDED" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("SUSPENDED")}
          >
            ⏸️ Suspended
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "PENDING" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            ⏳ Pending
          </button>
        </div>
      </div>

      <div className="service-providers-grid">
        {filteredProviders.map(provider => (
          <div key={provider._id} className="service-providers-card">
            <div className="service-providers-card-header">
              <div className="service-providers-avatar">
                <div className="service-providers-avatar-circle">
                  {getInitial(provider.fullName)}
                </div>
                <div 
                  className={`service-providers-status-indicator service-providers-status-${(provider.status || 'pending').toLowerCase()}`}
                />
              </div>
              
              <div className="service-providers-info">
                <h4 className="service-providers-name">{provider.fullName}</h4>
                {provider.companyName && (
                  <p className="service-providers-company">{provider.companyName}</p>
                )}
                <p className="service-providers-id">ID: {provider._id.slice(-8)}</p>
              </div>
              
              <div className="service-providers-status-badge">
                <span className={`service-providers-status service-providers-status-${(provider.status || 'pending').toLowerCase()}`}>
                  {provider.status || 'PENDING'}
                </span>
              </div>
            </div>

            <div className="service-providers-details">
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">📧</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Email</span>
                  <span className="service-providers-detail-value">{provider.email}</span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">📱</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Phone</span>
                  <span className="service-providers-detail-value">{provider.whatsappNumber || 'N/A'}</span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">🛣️</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Routes</span>
                  <span className="service-providers-detail-value">{provider.routeListings?.length || 0} routes</span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">⭐</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Rating</span>
                  <span className="service-providers-detail-value">{provider.rating || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="service-providers-actions">
              <button 
                className="service-providers-view-btn"
                onClick={() => handleViewDetails(provider)}
              >
                👁️ View Details
              </button>
              
              {(provider.status || 'PENDING') === "ACTIVE" ? (
                <button 
                  className="service-providers-suspend-btn"
                  onClick={() => handleProviderAction(provider._id, 'suspend')}
                  disabled={actionLoading}
                >
                  {actionLoading ? '⏳' : '⏸️'} Suspend
                </button>
              ) : (
                <button 
                  className="service-providers-activate-btn"
                  onClick={() => handleProviderAction(provider._id, 'activate')}
                  disabled={actionLoading}
                >
                  {actionLoading ? '⏳' : '✅'} Activate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <div className="service-providers-empty">
          <div className="service-providers-empty-icon">🔍</div>
          <h3>No Service Providers Found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Provider Details Modal */}
      {showDetailsModal && selectedProvider && (
        <div className="service-providers-modal-overlay" onClick={handleCloseModal}>
          <div className="service-providers-modal" onClick={(e) => e.stopPropagation()}>
            <div className="service-providers-modal-header">
              <h3>Provider Details</h3>
              <button className="service-providers-modal-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            
            <div className="service-providers-modal-content">
              <div className="service-providers-modal-avatar">
                <div className="service-providers-avatar-circle">
                  {getInitial(selectedProvider.fullName)}
                </div>
                <div 
                  className={`service-providers-status-indicator service-providers-status-${(selectedProvider.status || 'pending').toLowerCase()}`}
                />
              </div>
              
              <div className="service-providers-modal-info">
                <h4>{selectedProvider.fullName}</h4>
                {selectedProvider.companyName && (
                  <p className="service-providers-modal-company">{selectedProvider.companyName}</p>
                )}
                <div className="service-providers-modal-status">
                  <span className={`service-providers-status service-providers-status-${(selectedProvider.status || 'pending').toLowerCase()}`}>
                    {selectedProvider.status || 'PENDING'}
                  </span>
                </div>
              </div>
              
              <div className="service-providers-modal-details">
                <div className="service-providers-modal-section">
                  <h5>Contact Information</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Email:</span>
                    <span className="service-providers-modal-value">{selectedProvider.email}</span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Phone:</span>
                    <span className="service-providers-modal-value">{selectedProvider.whatsappNumber || 'N/A'}</span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">User ID:</span>
                    <span className="service-providers-modal-value">{selectedProvider._id}</span>
                  </div>
                </div>
                
                <div className="service-providers-modal-section">
                  <h5>Business Information</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Role:</span>
                    <span className="service-providers-modal-value">{selectedProvider.role}</span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Routes:</span>
                    <span className="service-providers-modal-value">{selectedProvider.routeListings?.length || 0} routes</span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Rating:</span>
                    <span className="service-providers-modal-value">{selectedProvider.rating || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="service-providers-modal-section">
                  <h5>Account Status</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Status:</span>
                    <span className="service-providers-modal-value">{selectedProvider.status || 'PENDING'}</span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Created:</span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.createdAt ? new Date(selectedProvider.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Last Updated:</span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.updatedAt ? new Date(selectedProvider.updatedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="service-providers-modal-actions">
              <button className="service-providers-modal-btn service-providers-modal-btn-secondary" onClick={handleCloseModal}>
                Close
              </button>
              
              {(selectedProvider.status || 'PENDING') === "ACTIVE" ? (
                <button 
                  className="service-providers-modal-btn service-providers-modal-btn-danger"
                  onClick={() => {
                    handleProviderAction(selectedProvider._id, 'suspend')
                    handleCloseModal()
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? '⏳' : '⏸️'} Suspend Provider
                </button>
              ) : (
                <button 
                  className="service-providers-modal-btn service-providers-modal-btn-success"
                  onClick={() => {
                    handleProviderAction(selectedProvider._id, 'activate')
                    handleCloseModal()
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? '⏳' : '✅'} Activate Provider
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminServiceProviders
