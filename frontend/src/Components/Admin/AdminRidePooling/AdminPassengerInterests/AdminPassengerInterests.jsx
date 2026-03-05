"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminPassengerInterests.css"
import api from "../../../../utils/api"

const AdminPassengerInterests = () => {
  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInterest, setSelectedInterest] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const fetchPassengerInterests = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/ride-pooling/passenger-interests', {
        params: { status: statusFilter !== "all" ? statusFilter : undefined }
      })
      setInterests(response.data.interests)
    } catch (error) {
      console.error("Error fetching passenger interests:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchPassengerInterests()
  }, [fetchPassengerInterests])

  const handleStatusChange = async (interestId, newStatus) => {
    try {
      await api.put(`/admin/ride-pooling/passenger-interests/${interestId}/status`, {
        status: newStatus
      })
      fetchPassengerInterests()
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const filteredInterests = interests.filter(interest => 
    interest.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interest.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interest.dropoffLocation.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "#28a745"
      case "pending": return "#ffc107"
      case "under_review": return "#17a2b8"
      case "rejected": return "#dc3545"
      case "completed": return "#6f42c1"
      default: return "#6c757d"
    }
  }

  const formatStatus = (status) => {
    if (!status) return "Pending"
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
  }

  if (loading) {
    return (
      <div className="admin-passenger-interests">
        <div className="loading">Loading passenger interests...</div>
      </div>
    )
  }

  return (
    <div className="admin-passenger-interests">
      <div className="interests-header">
        <h3>Passenger Interests</h3>
        <div className="interests-filters">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <input
            type="text"
            placeholder="Search by name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="interests-table">
        <table>
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Preferred Time</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Matched Routes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterests.map(interest => (
              <tr key={interest._id}>
                <td>
                  <div className="passenger-info">
                    <span className="passenger-name">{interest.passengerName}</span>
                    <span className="passenger-id">{interest.passengerId}</span>
                  </div>
                </td>
                <td>{interest.pickupLocation}</td>
                <td>{interest.dropoffLocation}</td>
                <td>{interest.preferredTime}</td>
                <td>{interest.frequency}</td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(interest.status) }}
                  >
                    {formatStatus(interest.status)}
                  </span>
                </td>
                <td>{interest.matchedRoutes}</td>
                <td>
                  <div className="action-buttons">
                    <button className="view-btn" onClick={() => { setSelectedInterest(interest); setShowDetailModal(true) }}>View Details</button>
                    {interest.status === 'pending' && (
                      <>
                        <button 
                          className="approve-btn"
                          onClick={() => handleStatusChange(interest._id, 'APPROVED')}
                        >
                          Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleStatusChange(interest._id, 'REJECTED')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {interest.status === 'approved' && (
                      <button 
                        className="deactivate-btn"
                        onClick={() => handleStatusChange(interest._id, 'REJECTED')}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredInterests.length === 0 && (
        <div className="no-interests">
          <p>No passenger interests found</p>
        </div>
      )}

      {showDetailModal && selectedInterest && (
        <div className="interest-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="interest-modal" onClick={(e) => e.stopPropagation()}>
            <div className="interest-modal-header">
              <h3>Passenger Interest Details</h3>
              <button className="interest-modal-close" onClick={() => setShowDetailModal(false)}>X</button>
            </div>
            <div className="interest-modal-body">
              <div className="interest-detail-grid">
                <div className="interest-detail-row">
                  <span className="detail-label">Passenger</span>
                  <span className="detail-value">{selectedInterest.passengerName}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Pickup</span>
                  <span className="detail-value">{selectedInterest.pickupLocation}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Dropoff</span>
                  <span className="detail-value">{selectedInterest.dropoffLocation}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Preferred Time</span>
                  <span className="detail-value">{selectedInterest.preferredTime}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Frequency</span>
                  <span className="detail-value">{selectedInterest.frequency}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Status</span>
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(selectedInterest.status) }}>
                    {formatStatus(selectedInterest.status)}
                  </span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Matched Routes</span>
                  <span className="detail-value">{selectedInterest.matchedRoutes || 0}</span>
                </div>
                <div className="interest-detail-row">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">{selectedInterest.createdAt ? new Date(selectedInterest.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPassengerInterests
