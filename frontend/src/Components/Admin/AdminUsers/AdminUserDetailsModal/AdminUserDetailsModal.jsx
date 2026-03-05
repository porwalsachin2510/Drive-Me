"use client"

import "./AdminUserDetailsModal.css"

function AdminUserDetailsModal({ user, onClose }) {
  if (!user) return null

  return (
    <div className="admin-user-details-modal-overlay" onClick={onClose}>
      <div className="admin-user-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-user-details-modal-header">
          <div>
            <h2 className="admin-user-details-modal-title">
              {user.type === "Corporate" ? user.name : `${user.name} - Full Details`}
            </h2>
            <p className="admin-user-details-modal-subtitle">
              Review complete application details including routes, vehicles, and drivers.
            </p>
          </div>
          <button className="admin-user-details-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="admin-user-details-modal-body">
          <div className="admin-user-details-info-grid">
            <div className="admin-user-details-info-item">
              <span className="admin-user-details-label">STATUS</span>
              <span className={`admin-user-details-status admin-user-details-status-${user.status.toLowerCase()}`}>
                {user.status}
              </span>
            </div>
            <div className="admin-user-details-info-item">
              <span className="admin-user-details-label">REQUEST ID</span>
              <span className="admin-user-details-value">{user.id}</span>
            </div>
            <div className="admin-user-details-info-item">
              <span className="admin-user-details-label">TYPE</span>
              <span className="admin-user-details-value">{user.type}</span>
            </div>
          </div>

          <div className="admin-user-details-section">
            <h3 className="admin-user-details-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Route Information
            </h3>
            <div className="admin-user-details-route">
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">From</span>
                <span className="admin-user-details-value">{user.from}</span>
              </div>
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">To</span>
                <span className="admin-user-details-value">{user.to}</span>
              </div>
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">Time</span>
                <span className="admin-user-details-value">{user.time}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-user-details-modal-footer">
          <button className="admin-user-details-btn admin-user-details-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="admin-user-details-btn admin-user-details-btn-primary">Approve Request</button>
        </div>
      </div>
    </div>
  )
}

export default AdminUserDetailsModal
