"use client";

import { useState, useEffect } from "react";
import "./AdminServiceProviders.css";
import api from "../../../../utils/api";

const svg = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);
const ICONS = {
  bus: svg(<><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></>),
  users: svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  check: svg(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  pause: svg(<><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></>),
  clock: svg(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  search: svg(<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  list: svg(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>),
  mail: svg(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>),
  phone: svg(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />),
  route: svg(<><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>),
  star: svg(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  eye: svg(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>),
  x: svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  alert: svg(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
};

function AdminServiceProviders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState({
    totalProviders: 0,
    activeProviders: 0,
    suspendedProviders: 0,
    pendingProviders: 0,
  });

  useEffect(() => {
    fetchProviders();
    fetchProviderStats();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      // Fetch B2C stats
      await api.get("/admin/b2c/stats");

      // Get real B2C providers data
      const providersResponse = await api.get("/admin/users?role=B2C_PARTNER");

      if (providersResponse.data.success) {
        setProviders(providersResponse.data.users || []);
      }
    } catch (error) {
      console.error("Error fetching B2C providers:", error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderStats = async () => {
    try {
      const response = await api.get("/admin/b2c/stats");

      console.log("B2C Stats Response:", response.data); // Debug log

      if (response.data.success && response.data.stats) {
        const data = response.data.stats.providers || {};
        console.log("Provider Stats Data:", data); // Debug log

        setStats({
          totalProviders: data.totalProviders || 0,
          activeProviders: data.activeProviders || 0,
          suspendedProviders: data.suspendedProviders || 0,
          pendingProviders: data.pendingProviders || 0,
        });
      } else {
        console.warn("Unexpected response structure:", response.data);
        // Set fallback values
        setStats({
          totalProviders: 0,
          activeProviders: 0,
          suspendedProviders: 0,
          pendingProviders: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching provider stats:", error);
      // Set fallback values on error
      setStats({
        totalProviders: 0,
        activeProviders: 0,
        suspendedProviders: 0,
        pendingProviders: 0,
      });
    }
  };

  const handleProviderAction = async (providerId, action) => {
    try {
      setActionLoading(true);
      const endpoint = action === "suspend" ? "suspend" : "activate";
      const response = await api.put(
        `/admin/providers/b2c/${providerId}/${endpoint}`,
      );

      if (response.data.success) {
        setNotification({
          type: "success",
          message: `Provider ${action}d successfully!`,
        });
        // Refresh both providers and stats
        await Promise.all([fetchProviders(), fetchProviderStats()]);
      } else {
        throw new Error(
          response.data.message || `Failed to ${action} provider`,
        );
      }
    } catch (error) {
      console.error(`Error ${action} provider:`, error);
      setNotification({
        type: "error",
        message: error.message || `Failed to ${action} provider`,
      });
    } finally {
      setActionLoading(false);
      // Hide notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleViewDetails = (provider) => {
    setSelectedProvider(provider);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedProvider(null);
  };

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch =
      provider.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.companyName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || (provider.status || "PENDING") === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const _getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return "#28a745";
      case "SUSPENDED":
        return "#dc3545";
      case "PENDING":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  const getInitial = (name) => {
    return name && name.trim() ? name.charAt(0).toUpperCase() : "P";
  };

  if (loading) {
    return (
      <div className="service-providers-container">
        <div className="service-providers-loading">
          <div className="service-providers-spinner"></div>
          <p>Loading service providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="service-providers-container">
      {/* Notification */}
      {notification && (
        <div
          className={`service-providers-notification service-providers-notification-${notification.type}`}
        >
          <span className="service-providers-notification-icon">
            {notification.type === "success" ? ICONS.check : ICONS.alert}
          </span>
          <span className="service-providers-notification-message">
            {notification.message}
          </span>
        </div>
      )}

      <div className="service-providers-header">
        <div className="service-providers-title-section">
          <h3 className="service-providers-title">
            <span className="service-providers-icon">{ICONS.bus}</span>
            B2C Service Providers
          </h3>
          <p className="service-providers-description">
            Manage and monitor all B2C transport service providers
          </p>
        </div>

        <div className="service-providers-stats">
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon">{ICONS.users}</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">
                {stats.totalProviders}
              </span>
              <span className="service-providers-stat-label">Total</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon service-providers-stat-icon-active">{ICONS.check}</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">
                {stats.activeProviders}
              </span>
              <span className="service-providers-stat-label">Active</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon service-providers-stat-icon-suspended">{ICONS.pause}</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">
                {stats.suspendedProviders}
              </span>
              <span className="service-providers-stat-label">Suspended</span>
            </div>
          </div>
          <div className="service-providers-stat-item">
            <div className="service-providers-stat-icon service-providers-stat-icon-pending">{ICONS.clock}</div>
            <div className="service-providers-stat-content">
              <span className="service-providers-stat-number">
                {stats.pendingProviders}
              </span>
              <span className="service-providers-stat-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="service-providers-controls">
        <div className="service-providers-search">
          <div className="service-providers-search-container">
            <span className="service-providers-search-icon">{ICONS.search}</span>
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
            <span className="service-providers-filter-icon">{ICONS.list}</span> All Providers
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "ACTIVE" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("ACTIVE")}
          >
            <span className="service-providers-filter-icon">{ICONS.check}</span> Active
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "SUSPENDED" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("SUSPENDED")}
          >
            <span className="service-providers-filter-icon">{ICONS.pause}</span> Suspended
          </button>
          <button
            className={`service-providers-filter-btn ${statusFilter === "PENDING" ? "service-providers-active" : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            <span className="service-providers-filter-icon">{ICONS.clock}</span> Pending
          </button>
        </div>
      </div>

      <div className="service-providers-grid">
        {filteredProviders.map((provider) => (
          <div key={provider._id} className="service-providers-card">
            <div className="service-providers-card-header">
              <div className="service-providers-avatar">
                <div className="service-providers-avatar-circle">
                  {getInitial(provider.fullName)}
                </div>
                <div
                  className={`service-providers-status-indicator service-providers-status-${(provider.status || "pending").toLowerCase()}`}
                />
              </div>

              <div className="service-providers-info">
                <h4 className="service-providers-name">{provider.fullName}</h4>
                {provider.companyName && (
                  <p className="service-providers-company">
                    {provider.companyName}
                  </p>
                )}
                <p className="service-providers-id">
                  ID: {provider._id.slice(-8)}
                </p>
              </div>

              <div className="service-providers-status-badge">
                <span
                  className={`service-providers-status service-providers-status-${(provider.status || "pending").toLowerCase()}`}
                >
                  {provider.status || "PENDING"}
                </span>
              </div>
            </div>

            <div className="service-providers-details">
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">{ICONS.mail}</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Email</span>
                  <span className="service-providers-detail-value">
                    {provider.email}
                  </span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">{ICONS.phone}</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Phone</span>
                  <span className="service-providers-detail-value">
                    {provider.whatsappNumber || "N/A"}
                  </span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">{ICONS.route}</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Routes</span>
                  <span className="service-providers-detail-value">
                    {provider.routeCount ?? provider.routeListings?.length ?? 0}{" "}
                    routes
                  </span>
                </div>
              </div>
              <div className="service-providers-detail-item">
                <span className="service-providers-detail-icon">{ICONS.star}</span>
                <div className="service-providers-detail-content">
                  <span className="service-providers-detail-label">Rating</span>
                  <span className="service-providers-detail-value">
                    {provider.rating ? provider.rating : "New"}
                  </span>
                </div>
              </div>
            </div>

            <div className="service-providers-actions">
              <button
                className="service-providers-view-btn"
                onClick={() => handleViewDetails(provider)}
              >
                <span className="service-providers-btn-icon">{ICONS.eye}</span> View Details
              </button>

              {(provider.status || "PENDING") === "ACTIVE" ? (
                <button
                  className="service-providers-suspend-btn"
                  onClick={() => handleProviderAction(provider._id, "suspend")}
                  disabled={actionLoading}
                >
                  <span className="service-providers-btn-icon">{actionLoading ? ICONS.clock : ICONS.pause}</span> Suspend
                </button>
              ) : (
                <button
                  className="service-providers-activate-btn"
                  onClick={() => handleProviderAction(provider._id, "activate")}
                  disabled={actionLoading}
                >
                  <span className="service-providers-btn-icon">{actionLoading ? ICONS.clock : ICONS.check}</span> Activate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <div className="service-providers-empty">
          <div className="service-providers-empty-icon">{ICONS.search}</div>
          <h3>No Service Providers Found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Provider Details Modal */}
      {showDetailsModal && selectedProvider && (
        <div className="service-providers-modal-overlay">
          <div
            className="service-providers-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="service-providers-modal-header">
              <h3>Provider Details</h3>
              <button
                className="service-providers-modal-close"
                onClick={handleCloseModal}
              >
                {ICONS.x}
              </button>
            </div>

            <div className="service-providers-modal-content">
              <div className="service-providers-modal-avatar">
                <div className="service-providers-avatar-circle">
                  {getInitial(selectedProvider.fullName)}
                </div>
                <div
                  className={`service-providers-status-indicator service-providers-status-${(selectedProvider.status || "pending").toLowerCase()}`}
                />
              </div>

              <div className="service-providers-modal-info">
                <h4>{selectedProvider.fullName}</h4>
                {selectedProvider.companyName && (
                  <p className="service-providers-modal-company">
                    {selectedProvider.companyName}
                  </p>
                )}
                <div className="service-providers-modal-status">
                  <span
                    className={`service-providers-status service-providers-status-${(selectedProvider.status || "pending").toLowerCase()}`}
                  >
                    {selectedProvider.status || "PENDING"}
                  </span>
                </div>
              </div>

              <div className="service-providers-modal-details">
                <div className="service-providers-modal-section">
                  <h5>Contact Information</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Email:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.email}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Phone:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.whatsappNumber || "N/A"}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      User ID:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider._id}
                    </span>
                  </div>
                </div>

                <div className="service-providers-modal-section">
                  <h5>Business Information</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">Role:</span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.role}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Routes:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.routeCount ??
                        selectedProvider.routeListings?.length ??
                        0}{" "}
                      routes
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Rating:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.rating ? selectedProvider.rating : "New"}
                    </span>
                  </div>
                </div>

                <div className="service-providers-modal-section">
                  <h5>Account Status</h5>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Status:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.status || "PENDING"}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Created:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.createdAt
                        ? new Date(
                            selectedProvider.createdAt,
                          ).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="service-providers-modal-detail">
                    <span className="service-providers-modal-label">
                      Last Updated:
                    </span>
                    <span className="service-providers-modal-value">
                      {selectedProvider.updatedAt
                        ? new Date(
                            selectedProvider.updatedAt,
                          ).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="service-providers-modal-actions">
              <button
                className="service-providers-modal-btn service-providers-modal-btn-secondary"
                onClick={handleCloseModal}
              >
                Close
              </button>

              {(selectedProvider.status || "PENDING") === "ACTIVE" ? (
                <button
                  className="service-providers-modal-btn service-providers-modal-btn-danger"
                  onClick={() => {
                    handleProviderAction(selectedProvider._id, "suspend");
                    handleCloseModal();
                  }}
                  disabled={actionLoading}
                >
                  <span className="service-providers-btn-icon">{actionLoading ? ICONS.clock : ICONS.pause}</span> Suspend Provider
                </button>
              ) : (
                <button
                  className="service-providers-modal-btn service-providers-modal-btn-success"
                  onClick={() => {
                    handleProviderAction(selectedProvider._id, "activate");
                    handleCloseModal();
                  }}
                  disabled={actionLoading}
                >
                  <span className="service-providers-btn-icon">{actionLoading ? ICONS.clock : ICONS.check}</span> Activate Provider
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminServiceProviders;
