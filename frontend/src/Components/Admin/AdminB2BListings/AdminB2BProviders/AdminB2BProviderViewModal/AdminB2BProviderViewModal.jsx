"use client"

import "./AdminB2BProviderViewModal.css"

function AdminB2BProviderViewModal({ provider, onClose, onApprove, onReject, onRequestInfo }) {
  if (!provider) return null

  return (
    <div className="admin-b2b-view-modal-overlay" onClick={onClose}>
      <div className="admin-b2b-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-b2b-view-modal-header">
          <div>
            <h2 className="admin-b2b-view-modal-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              {provider.name} - Full Details
            </h2>
            <p className="admin-b2b-view-modal-subtitle">
              Review complete application details including routes, vehicles, and drivers.
            </p>
          </div>
          <button className="admin-b2b-view-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="admin-b2b-view-modal-body">
          <div className="admin-b2b-view-info-grid">
            <div className="admin-b2b-view-info-item">
              <span className="admin-b2b-view-label">STATUS</span>
              <span
                className={`admin-b2b-view-status admin-b2b-view-status-${provider.status.toLowerCase().replace(/ /g, "-")}`}
              >
                {provider.status}
              </span>
            </div>
            <div className="admin-b2b-view-info-item">
              <span className="admin-b2b-view-label">CONTACT EMAIL</span>
              <span className="admin-b2b-view-value">{provider.contact}</span>
            </div>
            <div className="admin-b2b-view-info-item">
              <span className="admin-b2b-view-label">PHONE</span>
              <span className="admin-b2b-view-value">{provider.phone}</span>
            </div>
          </div>

          <div className="admin-b2b-view-info-grid">
            <div className="admin-b2b-view-info-item">
              <span className="admin-b2b-view-label">JOIN DATE</span>
              <span className="admin-b2b-view-value">{provider.joinDate}</span>
            </div>
            <div className="admin-b2b-view-info-item">
              <span className="admin-b2b-view-label">RATING</span>
              <span className="admin-b2b-view-rating">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {provider.rating}
              </span>
            </div>
          </div>

          <div className="admin-b2b-view-section">
            <h3 className="admin-b2b-view-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              Fleet Details
            </h3>
            <div className="admin-b2b-view-fleet-table-container">
              <table className="admin-b2b-view-fleet-table">
                <thead>
                  <tr>
                    <th>Vehicle Type</th>
                    <th>Model Info</th>
                    <th>Capacity</th>
                    <th>Count</th>
                    <th>Images</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.vehicles && provider.vehicles.length > 0 ? (
                    provider.vehicles.map((vehicle, index) => (
                      <tr key={index}>
                        <td>{vehicle.type}</td>
                        <td>
                          <div className="admin-b2b-view-model-info">
                            <div>{vehicle.model}</div>
                            <div className="admin-b2b-view-model-year">Year: {vehicle.year}</div>
                          </div>
                        </td>
                        <td>{vehicle.capacity}</td>
                        <td>
                          <span className="admin-b2b-view-count">{vehicle.count} Units</span>
                        </td>
                        <td>
                          <button className="admin-b2b-view-images-btn">View Images</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#9ca3af" }}>
                        No vehicle information available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="admin-b2b-view-modal-footer">
          <button className="admin-b2b-view-btn admin-b2b-view-btn-approve" onClick={() => onApprove(provider.id)}>
            Approve Provider
          </button>
          <button className="admin-b2b-view-btn admin-b2b-view-btn-reject" onClick={() => onReject(provider.id)}>
            Reject Provider
          </button>
          <button className="admin-b2b-view-btn admin-b2b-view-btn-info" onClick={() => onRequestInfo(provider.id)}>
            Request Info
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminB2BProviderViewModal
