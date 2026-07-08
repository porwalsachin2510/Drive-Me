"use client";

import { useState } from "react";
import "./AdminB2BProviderViewModal.css";

function AdminB2BProviderViewModal({
  provider,
  onClose,
  onApprove,
  onReject,
  onRequestInfo,
}) {
  const [imageViewer, setImageViewer] = useState(null);

  if (!provider) return null;

  return (
    <div className="admin-b2b-view-modal-overlay" onClick={onClose}>
      <div
        className="admin-b2b-view-modal"
        onClick={(e) => e.stopPropagation()}
      >
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
              Review complete application details including routes, vehicles,
              and drivers.
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
                {provider.rating > 0 ? provider.rating : "New"}
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
                  {provider.detailsLoading ? (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          color: "#9ca3af",
                        }}
                      >
                        Loading fleet details...
                      </td>
                    </tr>
                  ) : provider.vehicles && provider.vehicles.length > 0 ? (
                    provider.vehicles.map((vehicle, index) => (
                      <tr key={vehicle.id || index}>
                        <td>{vehicle.type}</td>
                        <td>
                          <div className="admin-b2b-view-model-info">
                            <div>{vehicle.model}</div>
                            <div className="admin-b2b-view-model-year">
                              Year: {vehicle.year}
                            </div>
                          </div>
                        </td>
                        <td>{vehicle.capacity}</td>
                        <td>
                          <span className="admin-b2b-view-count">
                            {vehicle.count} Unit{vehicle.count > 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          {vehicle.images && vehicle.images.length > 0 ? (
                            <button
                              className="admin-b2b-view-images-btn"
                              onClick={() =>
                                setImageViewer({
                                  title: `${vehicle.type} - ${vehicle.model}`,
                                  images: vehicle.images,
                                })
                              }
                            >
                              View Images ({vehicle.images.length})
                            </button>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>No images</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          color: "#9ca3af",
                        }}
                      >
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
          <button
            className="admin-b2b-view-btn admin-b2b-view-btn-approve"
            onClick={() => onApprove(provider.id)}
          >
            Approve Provider
          </button>
          <button
            className="admin-b2b-view-btn admin-b2b-view-btn-reject"
            onClick={() => onReject(provider.id)}
          >
            Reject Provider
          </button>
          <button
            className="admin-b2b-view-btn admin-b2b-view-btn-info"
            onClick={() => onRequestInfo(provider.id)}
          >
            Request Info
          </button>
        </div>

        {imageViewer && (
          <div
            className="admin-b2b-view-image-viewer-overlay"
            onClick={() => setImageViewer(null)}
          >
            <div
              className="admin-b2b-view-image-viewer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-b2b-view-image-viewer-header">
                <h4>{imageViewer.title}</h4>
                <button
                  className="admin-b2b-view-image-viewer-close"
                  onClick={() => setImageViewer(null)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="admin-b2b-view-image-viewer-grid">
                {imageViewer.images.map((src, i) => (
                  <img
                    key={i}
                    src={src || "/placeholder.svg"}
                    alt={`${imageViewer.title} ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminB2BProviderViewModal;
