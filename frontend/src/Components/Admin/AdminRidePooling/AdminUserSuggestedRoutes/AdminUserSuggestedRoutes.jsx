"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminUserSuggestedRoutes.css"
import api from "../../../../utils/api"

const AdminUserSuggestedRoutes = () => {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null)

  const fetchSuggestedRoutes = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/ride-pooling/suggested-routes', {
        params: { status: statusFilter !== "all" ? statusFilter : undefined }
      })
      setRoutes(response.data.routes)
    } catch (error) {
      console.error("Error fetching suggested routes:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchSuggestedRoutes()
  }, [fetchSuggestedRoutes])

  const handleApprove = async (routeId) => {
    try {
      await api.put(`/admin/ride-pooling/suggested-routes/${routeId}/approve`)
      fetchSuggestedRoutes()
    } catch (error) {
      console.error("Error approving route:", error)
    }
  }

  const handleReject = async (routeId) => {
    setSelectedRoute(routeId)
    setShowRejectModal(true)
  }

  const handleViewDetails = (route) => {
    setSelectedRouteDetails(route)
    setShowDetailsModal(true)
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRouteDetails(null)
  }

  const confirmRejection = async () => {
    try {
      await api.put(`/admin/ride-pooling/suggested-routes/${selectedRoute}/reject`, {
        reason: rejectionReason
      })
      setShowRejectModal(false)
      setRejectionReason("")
      setSelectedRoute(null)
      fetchSuggestedRoutes()
    } catch (error) {
      console.error("Error rejecting route:", error)
    }
  }

  const filteredRoutes = routes.filter(route => 
    route.routeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.startPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.endPoint.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "#28a745"
      case "under-review": 
      case "under_review": 
      case "pending": return "#ffc107"
      case "rejected": return "#dc3545"
      case "completed": return "#6f42c1"
      default: return "#6c757d"
    }
  }

  if (loading) {
    return (
      <div className="ad-dash-user-suggested-routes">
        <div className="loading">Loading suggested routes...</div>
      </div>
    )
  }

  return (
    <div className="ad-dash-user-suggested-routes">
      <div className="ad-dash-user-suggested-routes-header">
        <div className="ad-dash-user-suggested-routes-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
          </svg>
          <span>New Route Suggestions</span>
        </div>
        
        <div className="suggested-routes-filters">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="text"
            placeholder="Search routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="suggested-routes-table">
        <table>
          <thead>
            <tr>
              <th>Route Name</th>
              <th>User</th>
              <th>Start Point</th>
              <th>End Point</th>
              <th>Distance</th>
              <th>Price</th>
              <th>Votes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map(route => (
              <tr key={route._id}>
                <td>
                  <div className="route-info">
                    <span className="route-name">{route.routeName}</span>
                    <span className="route-time">{route.estimatedTime}</span>
                  </div>
                </td>
                <td>
                  <div className="user-info">
                    <span className="user-name">{route.userName}</span>
                    <span className="user-id">{route.userId}</span>
                  </div>
                </td>
                <td>{route.startPoint}</td>
                <td>{route.endPoint}</td>
                <td>{route.distance}</td>
                <td>KWD {route.suggestedPrice.toFixed(2)}</td>
                <td>
                  <div className="votes">
                    <span className="vote-count">{route.votes}</span>
                    <span className="vote-label">votes</span>
                  </div>
                </td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(route.status) }}
                  >
                    {route.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="view-btn" onClick={() => handleViewDetails(route)}>View Details</button>
                    {(route.status === 'under-review' || route.status === 'under_review' || route.status === 'pending') && (
                      <>
                        <button 
                          className="approve-btn"
                          onClick={() => handleApprove(route._id)}
                        >
                          Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleReject(route._id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="no-routes">
          <p>No suggested routes found</p>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Reject Route Suggestion</h3>
              <button className="close-btn" onClick={() => setShowRejectModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Rejection Reason:</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="reject-btn"
                  onClick={confirmRejection}
                  disabled={!rejectionReason.trim()}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Details Modal */}
      {showDetailsModal && selectedRouteDetails && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Route Details</h3>
              <button className="close-btn" onClick={closeDetailsModal}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Route Name</span>
                  <span style={{ fontWeight: '600' }}>{selectedRouteDetails.routeName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Suggested By</span>
                  <span>{selectedRouteDetails.userName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Start Point</span>
                  <span>{selectedRouteDetails.startPoint}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>End Point</span>
                  <span>{selectedRouteDetails.endPoint}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Distance</span>
                  <span>{selectedRouteDetails.distance}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Estimated Time</span>
                  <span>{selectedRouteDetails.estimatedTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Suggested Price</span>
                  <span style={{ fontWeight: '600', color: '#059669' }}>KWD {selectedRouteDetails.suggestedPrice?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Votes</span>
                  <span>{selectedRouteDetails.votes} votes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Status</span>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(selectedRouteDetails.status) }}
                  >
                    {selectedRouteDetails.status}
                  </span>
                </div>
                {selectedRouteDetails.description && (
                  <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                    <span style={{ color: '#6b7280', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Description</span>
                    <p style={{ margin: 0, color: '#374151' }}>{selectedRouteDetails.description}</p>
                  </div>
                )}
              </div>
              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button 
                  className="cancel-btn"
                  onClick={closeDetailsModal}
                >
                  Close
                </button>
                {(selectedRouteDetails.status === 'under-review' || selectedRouteDetails.status === 'under_review' || selectedRouteDetails.status === 'pending') && (
                  <>
                    <button 
                      className="approve-btn"
                      onClick={() => {
                        handleApprove(selectedRouteDetails._id)
                        closeDetailsModal()
                      }}
                    >
                      Approve
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => {
                        closeDetailsModal()
                        handleReject(selectedRouteDetails._id)
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUserSuggestedRoutes
