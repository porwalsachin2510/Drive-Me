"use client"

import { useState } from "react"
import "./AdminReassignModal.css"

const AdminReassignModal = ({ passenger, onClose }) => {
  const [selectedRoute, setSelectedRoute] = useState("")
  const [reason, setReason] = useState("")

  const routes = [
    "Route 5001: Hawally Loop",
    "Route 5002: Salwa Loop",
    "Route 5003: Kuwait City Loop",
    "Route 5014: Salmiya Loop",
    "Route 5016: Khaitan Loop",
  ]

  const handleConfirm = () => {
    console.log("Reassigning passenger:", { passenger, selectedRoute, reason })
    onClose()
  }

  return (
    <div className="ad-dash-reassign-modal-overlay" onClick={onClose}>
      <div className="ad-dash-reassign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-reassign-modal-header">
          <h3>Reassign Passenger</h3>
          <button className="ad-dash-reassign-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="ad-dash-reassign-modal-body">
          <p className="ad-dash-reassign-modal-description">
            Move <strong>{passenger?.name}</strong> from <em>{passenger?.route}</em> to a different route.
          </p>

          <div className="ad-dash-reassign-modal-field">
            <label>Select New Route</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="ad-dash-reassign-modal-select"
            >
              <option value="">Choose a route...</option>
              {routes.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
          </div>

          <div className="ad-dash-reassign-modal-field">
            <label>Reason for Reassignment</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Passenger requested timing change..."
              className="ad-dash-reassign-modal-textarea"
              rows="4"
            />
          </div>
        </div>

        <div className="ad-dash-reassign-modal-footer">
          <button className="ad-dash-reassign-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-dash-reassign-modal-confirm" onClick={handleConfirm} disabled={!selectedRoute}>
            Confirm Reassignment
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminReassignModal
