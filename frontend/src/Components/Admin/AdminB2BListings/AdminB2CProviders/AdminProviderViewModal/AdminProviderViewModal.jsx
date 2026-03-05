"use client"

import "./AdminProviderViewModal.css"

const AdminProviderViewModal = ({ provider, onClose, onApprove, onReject, onRequestInfo }) => {
  if (!provider) return null

  return (
    <div className="ad-dash-provider-view-modal-overlay" onClick={onClose}>
      <div className="ad-dash-provider-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-provider-view-modal-header">
          <div className="ad-dash-provider-view-modal-title-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <h3>{provider.name} - Full Details</h3>
          </div>
          <button className="ad-dash-provider-view-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="ad-dash-provider-view-modal-body">
          <p className="ad-dash-provider-view-modal-description">
            Review complete application details including routes, vehicles, and drivers.
          </p>

          <div className="ad-dash-provider-view-modal-info-grid">
            <div className="ad-dash-provider-view-modal-info-item">
              <span className="ad-dash-provider-view-modal-label">STATUS</span>
              <span
                className={`ad-dash-provider-view-modal-status ad-dash-provider-view-modal-status-${provider.status.toLowerCase()}`}
              >
                {provider.status}
              </span>
            </div>
            <div className="ad-dash-provider-view-modal-info-item">
              <span className="ad-dash-provider-view-modal-label">CONTACT EMAIL</span>
              <span className="ad-dash-provider-view-modal-value">{provider.contact}</span>
            </div>
            <div className="ad-dash-provider-view-modal-info-item">
              <span className="ad-dash-provider-view-modal-label">PHONE</span>
              <span className="ad-dash-provider-view-modal-value">{provider.phone}</span>
            </div>
            <div className="ad-dash-provider-view-modal-info-item">
              <span className="ad-dash-provider-view-modal-label">JOIN DATE</span>
              <span className="ad-dash-provider-view-modal-value">{provider.joinDate}</span>
            </div>
            <div className="ad-dash-provider-view-modal-info-item">
              <span className="ad-dash-provider-view-modal-label">RATING</span>
              <span className="ad-dash-provider-view-modal-rating">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                4.8
              </span>
            </div>
          </div>

          {provider.routes && provider.routes.length > 0 && (
            <div className="ad-dash-provider-view-modal-routes">
              <div className="ad-dash-provider-view-modal-section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
                </svg>
                Route Listings
              </div>
              {provider.routes.map((route, index) => (
                <div key={index} className="ad-dash-provider-view-modal-route-card">
                  <div className="ad-dash-provider-view-modal-route-header">
                    <div className="ad-dash-provider-view-modal-route-path">
                      {route.from} → {route.to}
                    </div>
                  </div>
                  <div className="ad-dash-provider-view-modal-route-details">
                    <div className="ad-dash-provider-view-modal-route-detail">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      In: {route.inTime}
                    </div>
                    <div className="ad-dash-provider-view-modal-route-detail">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Out: {route.outTime}
                    </div>
                    <div className="ad-dash-provider-view-modal-route-detail">1-Way: {route.oneWayPrice}</div>
                    <div className="ad-dash-provider-view-modal-route-detail">Round: {route.roundPrice}</div>
                  </div>
                  <div className="ad-dash-provider-view-modal-driver-info">
                    <div className="ad-dash-provider-view-modal-driver-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="ad-dash-provider-view-modal-driver-details">
                      <div className="ad-dash-provider-view-modal-driver-name">{route.driver.name}</div>
                      <div className="ad-dash-provider-view-modal-driver-meta">
                        {route.driver.nationality} • {route.driver.experience}
                      </div>
                      <div className="ad-dash-provider-view-modal-driver-license">{route.driver.license}</div>
                    </div>
                    <div className="ad-dash-provider-view-modal-seats">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {route.seats.filled}/{route.seats.total}
                      <div className="ad-dash-provider-view-modal-seats-bar">
                        <div
                          className="ad-dash-provider-view-modal-seats-fill"
                          style={{ width: `${(route.seats.filled / route.seats.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ad-dash-provider-view-modal-footer">
          {provider.status === "Pending" && (
            <>
              <button
                className="ad-dash-provider-view-modal-btn ad-dash-provider-view-modal-approve-btn"
                onClick={() => {
                  onApprove(provider.id)
                  onClose()
                }}
              >
                Approve Provider
              </button>
              <button
                className="ad-dash-provider-view-modal-btn ad-dash-provider-view-modal-reject-btn"
                onClick={() => {
                  onReject(provider.id)
                  onClose()
                }}
              >
                Reject Provider
              </button>
              <button
                className="ad-dash-provider-view-modal-btn ad-dash-provider-view-modal-info-btn"
                onClick={() => {
                  onRequestInfo(provider.id)
                  onClose()
                }}
              >
                Request Info
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminProviderViewModal
