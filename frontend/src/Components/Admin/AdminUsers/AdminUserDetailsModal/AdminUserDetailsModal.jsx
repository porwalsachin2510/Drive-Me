"use client"

import "./AdminUserDetailsModal.css"

function AdminUserDetailsModal({ user, onClose, onUpdate }) {
  if (!user) return null

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getRoleLabel = (role) => {
    const roleLabels = {
      'COMMUTER': 'Commuter',
      'CORPORATE': 'Corporate',
      'B2C_PARTNER': 'B2C Partner',
      'B2B_PARTNER': 'B2B Partner',
      'B2B_PARTNER_DRIVER': 'B2B Partner Driver',
      'CORPORATE_DRIVER': 'Corporate Driver',
      'ADMIN': 'Admin'
    }
    return roleLabels[role] || role
  }

  return (
    <div className="admin-user-details-modal-overlay" onClick={onClose}>
      <div className="admin-user-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-user-details-modal-header">
          <div>
            <h2 className="admin-user-details-modal-title">
              {user.fullName || 'User Details'}
            </h2>
            <p className="admin-user-details-modal-subtitle">
              View complete user profile information
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
              <span className={`admin-user-details-status admin-user-details-status-${user.status?.toLowerCase()}`}>
                {user.status || 'N/A'}
              </span>
            </div>
            <div className="admin-user-details-info-item">
              <span className="admin-user-details-label">USER ID</span>
              <span className="admin-user-details-value">{user._id || 'N/A'}</span>
            </div>
            <div className="admin-user-details-info-item">
              <span className="admin-user-details-label">ROLE</span>
              <span className="admin-user-details-value">{getRoleLabel(user.role)}</span>
            </div>
          </div>

          <div className="admin-user-details-section">
            <h3 className="admin-user-details-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Personal Information
            </h3>
            <div className="admin-user-details-route">
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">Full Name</span>
                <span className="admin-user-details-value">{user.fullName || 'N/A'}</span>
              </div>
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">Email</span>
                <span className="admin-user-details-value">{user.email || 'N/A'}</span>
              </div>
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">WhatsApp</span>
                <span className="admin-user-details-value">{user.whatsappNumber || 'N/A'}</span>
              </div>
              {user.companyName && (
                <div className="admin-user-details-route-item">
                  <span className="admin-user-details-label">Company</span>
                  <span className="admin-user-details-value">{user.companyName}</span>
                </div>
              )}
              {user.nationality && (
                <div className="admin-user-details-route-item">
                  <span className="admin-user-details-label">Nationality</span>
                  <span className="admin-user-details-value">{user.nationality}</span>
                </div>
              )}
            </div>
          </div>

          <div className="admin-user-details-section">
            <h3 className="admin-user-details-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Account Information
            </h3>
            <div className="admin-user-details-route">
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">Joined</span>
                <span className="admin-user-details-value">{formatDate(user.createdAt)}</span>
              </div>
              <div className="admin-user-details-route-item">
                <span className="admin-user-details-label">Last Updated</span>
                <span className="admin-user-details-value">{formatDate(user.updatedAt)}</span>
              </div>
              {user.lastLogin && (
                <div className="admin-user-details-route-item">
                  <span className="admin-user-details-label">Last Login</span>
                  <span className="admin-user-details-value">{formatDate(user.lastLogin)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="admin-user-details-modal-footer">
          <button className="admin-user-details-btn admin-user-details-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminUserDetailsModal
