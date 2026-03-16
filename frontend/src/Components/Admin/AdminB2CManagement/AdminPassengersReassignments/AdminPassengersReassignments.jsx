"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminPassengersReassignments.css"
import AdminReassignModal from "../AdminReassignModal/AdminReassignModal"
import api from "../../../../utils/api"

function AdminPassengersReassignments() {
  const [reassignments, setReassignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedReassignment, setSelectedReassignment] = useState(null)

  const fetchReassignments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/b2c/passenger-reassignments', {
        params: { status: statusFilter !== "all" ? statusFilter : undefined }
      })
      setReassignments(response.data.reassignments)
    } catch (error) {
      console.error("Error fetching reassignments:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchReassignments()
  }, [fetchReassignments])

  const handleProcessReassignment = async (reassignmentId, action, reason = "") => {
    try {
      await api.put(`/admin/b2c/passenger-reassignments/${reassignmentId}/process`, {
        action,
        reason
      })
      fetchReassignments()
    } catch (error) {
      console.error("Error processing reassignment:", error)
    }
  }

  const handleViewDetails = (reassignment) => {
    setSelectedReassignment(reassignment)
    setShowReassignModal(true)
  }

  const filteredReassignments = reassignments.filter(reassignment => {
    const term = searchTerm.toLowerCase()
    return (
      (reassignment.passengerName || '').toLowerCase().includes(term) ||
      (reassignment.passengerEmail || '').toLowerCase().includes(term) ||
      (reassignment.routeName || reassignment.originalRoute || '').toLowerCase().includes(term) ||
      (reassignment.providerName || reassignment.newRoute || '').toLowerCase().includes(term) ||
      (reassignment.startPoint || '').toLowerCase().includes(term) ||
      (reassignment.endPoint || '').toLowerCase().includes(term)
    )
  })

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "#28a745"
      case "rejected": return "#dc3545"
      case "pending": return "#ffc107"
      case "processing": return "#17a2b8"
      default: return "#6c757d"
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "#dc3545"
      case "normal": return "#28a745"
      case "low": return "#6c757d"
      default: return "#6c757d"
    }
  }

  if (loading) {
    return (
      <div className="ad-dash-passenger-reassignments">
        <div className="loading">Loading passenger reassignments...</div>
      </div>
    )
  }

  return (
    <div className="ad-dash-passenger-reassignments">
      <div className="ad-dash-pr-header">
        <div>
          <h3 className="ad-dash-pr-title">Passengers & Bookings</h3>
          <p className="ad-dash-pr-subtitle">Manage B2C passenger bookings, approvals, and route assignments.</p>
        </div>
      </div>

      <div className="ad-dash-pr-filters">
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
        </select>
        <input
          type="text"
          placeholder="Search by passenger, route, or reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="ad-dash-pr-table">
        <table>
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Route</th>
              <th>Provider</th>
              <th>Seats</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Booked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReassignments.map((booking) => (
              <tr key={booking._id}>
                <td>
                  <div className="passenger-info">
                    <span className="passenger-name">{booking.passengerName}</span>
                    <span className="passenger-email">{booking.passengerEmail}</span>
                  </div>
                </td>
                <td>
                  <div className="route-info">
                    <div className="route-name">{booking.routeName || `${booking.startPoint} - ${booking.endPoint}`}</div>
                    <div className="provider-name">{booking.startPoint} to {booking.endPoint}</div>
                  </div>
                </td>
                <td>
                  <span className="provider-text">{booking.providerName}</span>
                </td>
                <td>{booking.seats || 1}</td>
                <td>
                  <span className="amount-text">{booking.currency || 'KWD'} {(booking.amount || booking.price || 0).toFixed(booking.currency === 'KWD' || booking.currency === 'BHD' || booking.currency === 'OMR' ? 3 : 2)}</span>
                </td>
                <td>
                  <span className="payment-badge">{booking.paymentMethod || 'CASH'}</span>
                </td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor((booking.status || '').toLowerCase()) }}
                  >
                    {booking.status}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <span className="request-date">
                      {new Date(booking.bookingDate || booking.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="view-btn"
                      onClick={() => handleViewDetails(booking)}
                    >
                      View Details
                    </button>
                    {(booking.status === 'PENDING' || booking.status === 'pending') && (
                      <>
                        <button 
                          className="approve-btn"
                          onClick={() => handleProcessReassignment(booking._id, 'approved')}
                        >
                          Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleProcessReassignment(booking._id, 'rejected')}
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

      {filteredReassignments.length === 0 && (
        <div className="no-reassignments">
          <p>No passenger reassignments found</p>
        </div>
      )}

      {/* Reassignment Details Modal */}
      {showReassignModal && selectedReassignment && (
        <AdminReassignModal
          reassignment={selectedReassignment}
          onClose={() => {
            setShowReassignModal(false)
            setSelectedReassignment(null)
          }}
          onProcess={handleProcessReassignment}
        />
      )}
    </div>
  )
}

export default AdminPassengersReassignments
