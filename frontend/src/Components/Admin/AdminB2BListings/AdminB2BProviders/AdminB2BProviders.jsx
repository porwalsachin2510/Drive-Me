"use client"

import { useState, useEffect, useCallback } from "react"
import "./AdminB2BProviders.css"
import AdminB2BProviderViewModal from "./AdminB2BProviderViewModal/AdminB2BProviderViewModal"
import AdminChatModal from "./AdminChatModal/AdminChatModal"
import api from "../../../../utils/api"

const AdminB2BProviders = () => {
  const [showViewModal, setShowViewModal] = useState(false)
  const [showChatModal, setShowChatModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get("/admin/b2b/providers")
      if (response.data.success) {
        const formatted = response.data.providers.map((p) => ({
          id: p._id,
          name: p.companyName || p.contactPerson,
          initial: (p.companyName || p.contactPerson || "?").charAt(0).toUpperCase(),
          fleetSize: `${p.fleetSize || 0} Vehicles`,
          contact: p.email,
          phone: p.phone,
          joinDate: p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "N/A",
          status: p.status === "active" ? "Active" : p.status === "suspended" ? "Suspended" : "Pending",
          totalContracts: p.totalContracts || 0,
          activeVehicles: p.activeVehicles || 0,
          vehicles: [],
        }))
        setProviders(formatted)
      }
    } catch (err) {
      console.error("Error fetching B2B providers:", err)
      setError("Failed to load B2B providers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleView = (provider) => {
    setSelectedProvider(provider)
    setShowViewModal(true)
  }

  const handleChat = (provider) => {
    setSelectedProvider(provider)
    setShowChatModal(true)
  }

  const handleApprove = async (providerId) => {
    try {
      await api.put(`/admin/b2b/providers/${providerId}/activate`)
      setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, status: "Active" } : p)))
      setShowViewModal(false)
    } catch (err) {
      console.error("Error approving provider:", err)
    }
  }

  const handleReject = async (providerId) => {
    try {
      await api.put(`/admin/b2b/providers/${providerId}/suspend`)
      setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, status: "Suspended" } : p)))
      setShowViewModal(false)
    } catch (err) {
      console.error("Error rejecting provider:", err)
    }
  }

  const handleRequestMoreDetails = (providerId) => {
    setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, status: "More Details Requested" } : p)))
    setShowViewModal(false)
  }

  if (loading) {
    return (
      <div className="ad-dash-b2b-providers">
        <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
          Loading B2B providers...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ad-dash-b2b-providers">
        <div style={{ padding: "40px", textAlign: "center", color: "#e74c3c" }}>
          {error}
          <button onClick={fetchProviders} style={{ marginLeft: "12px", padding: "6px 16px", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", background: "#fff" }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ad-dash-b2b-providers">
      <div className="ad-dash-b2b-providers-table-container">
        {providers.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
            No B2B providers found.
          </div>
        ) : (
          <table className="ad-dash-b2b-providers-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Fleet Size</th>
                <th>Contact</th>
                <th>Join Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>
                    <div className="ad-dash-b2b-providers-provider-info">
                      <div className="ad-dash-b2b-providers-avatar">{provider.initial}</div>
                      <span className="ad-dash-b2b-providers-name">{provider.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="ad-dash-b2b-providers-fleet">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      {provider.fleetSize}
                    </div>
                  </td>
                  <td>
                    <div className="ad-dash-b2b-providers-contact">
                      <div>{provider.contact}</div>
                      <div className="ad-dash-b2b-providers-phone">{provider.phone}</div>
                    </div>
                  </td>
                  <td>{provider.joinDate}</td>
                  <td>
                    <span
                      className={`ad-dash-b2b-providers-status ad-dash-b2b-providers-status-${provider.status.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {provider.status}
                    </span>
                  </td>
                  <td>
                    <div className="ad-dash-b2b-providers-actions">
                      <button
                        className="ad-dash-b2b-providers-action-btn ad-dash-b2b-providers-view-btn"
                        onClick={() => handleView(provider)}
                        title="View"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {provider.status === "Pending" && (
                        <>
                          <button
                            className="ad-dash-b2b-providers-action-btn ad-dash-b2b-providers-approve-btn"
                            onClick={() => handleApprove(provider.id)}
                            title="Approve"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button
                            className="ad-dash-b2b-providers-action-btn ad-dash-b2b-providers-reject-btn"
                            onClick={() => handleReject(provider.id)}
                            title="Reject"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                          <button
                            className="ad-dash-b2b-providers-action-btn ad-dash-b2b-providers-chat-btn"
                            onClick={() => handleChat(provider)}
                            title="Request More Details"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showViewModal && selectedProvider && (
        <AdminB2BProviderViewModal
          provider={selectedProvider}
          onClose={() => setShowViewModal(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          onRequestInfo={handleRequestMoreDetails}
        />
      )}

      {showChatModal && selectedProvider && (
        <AdminChatModal provider={selectedProvider} onClose={() => setShowChatModal(false)} />
      )}
    </div>
  )
}

export default AdminB2BProviders
