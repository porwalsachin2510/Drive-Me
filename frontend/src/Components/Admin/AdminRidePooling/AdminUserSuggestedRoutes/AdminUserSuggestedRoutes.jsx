"use client";

import { useState, useEffect, useCallback } from "react";
import "./AdminUserSuggestedRoutes.css";
import api from "../../../../utils/api";

const AdminUserSuggestedRoutes = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null);

  // Open-to-marketplace flow
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [routeToOpen, setRouteToOpen] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // null = notify all active partners; array of partnerIds = notify only selected
  const [selectedPartnerIds, setSelectedPartnerIds] = useState([]);
  const [notifyAll, setNotifyAll] = useState(true);

  const fetchSuggestedRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/ride-pooling/suggested-routes", {
        params: { status: statusFilter !== "all" ? statusFilter : undefined },
      });
      setRoutes(response.data.routes);
    } catch (error) {
      console.error("Error fetching suggested routes:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSuggestedRoutes();
  }, [fetchSuggestedRoutes]);

  const openMarketplaceModal = (route) => {
    setRouteToOpen(route);
    setNotifyAll(true);
    // Pre-select partners who already expressed interest.
    setSelectedPartnerIds(
      (route.interestedPartners || []).map((p) => p.partnerId),
    );
    setShowOpenModal(true);
  };

  const closeMarketplaceModal = () => {
    setShowOpenModal(false);
    setRouteToOpen(null);
    setSubmitting(false);
  };

  const confirmOpenToMarketplace = async () => {
    try {
      setSubmitting(true);
      await api.put(
        `/admin/ride-pooling/suggested-routes/${routeToOpen._id}/open`,
        {
          // When notifyAll is true we omit partnerIds so the backend notifies every active partner.
          partnerIds: notifyAll ? undefined : selectedPartnerIds,
        },
      );
      closeMarketplaceModal();
      fetchSuggestedRoutes();
    } catch (error) {
      console.error("Error opening route to marketplace:", error);
      setSubmitting(false);
      alert(
        error.response?.data?.message || "Failed to open route to marketplace",
      );
    }
  };

  const handleReject = (routeId) => {
    setSelectedRoute(routeId);
    setShowRejectModal(true);
  };

  const handleViewDetails = (route) => {
    setSelectedRouteDetails(route);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedRouteDetails(null);
  };

  const confirmRejection = async () => {
    try {
      await api.put(
        `/admin/ride-pooling/suggested-routes/${selectedRoute}/reject`,
        {
          reason: rejectionReason,
        },
      );
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedRoute(null);
      fetchSuggestedRoutes();
    } catch (error) {
      console.error("Error rejecting route:", error);
    }
  };

  const filteredRoutes = routes.filter(
    (route) =>
      route.routeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.startPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.endPoint.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
      case "fulfilled":
        return "#28a745";
      case "open":
        return "#0891b2";
      case "under-review":
      case "under_review":
      case "pending":
        return "#ffc107";
      case "rejected":
        return "#dc3545";
      case "completed":
        return "#6f42c1";
      default:
        return "#6c757d";
    }
  };

  // Admin can act (open to marketplace / reject) while demand is still being collected.
  const isActionable = (status) =>
    status === "under-review" ||
    status === "under_review" ||
    status === "pending";

  // Once opened, Admin can re-notify more partners but the demand is already live.
  const isOpened = (status) => status === "open";

  if (loading) {
    return (
      <div className="ad-dash-user-suggested-routes">
        <div className="loading">Loading suggested routes...</div>
      </div>
    );
  }

  return (
    <div className="ad-dash-user-suggested-routes">
      <div className="ad-dash-user-suggested-routes-header">
        <div className="ad-dash-user-suggested-routes-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
          </svg>
          <span>New Route Suggestions</span>
        </div>

        <div className="suggested-routes-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="OPEN">Open to Partners</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="text"
            placeholder="Search routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="suggested-routes-table">
        <table>
          <thead>
            <tr>
              <th>Route Name</th>
              <th>Requested By</th>
              <th>Start Point</th>
              <th>End Point</th>
              <th>Preferred Time</th>
              <th>Demand</th>
              <th>Interested Partners</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map((route) => (
              <tr key={route._id}>
                <td>
                  <div className="route-info">
                    <span className="route-name">{route.routeName}</span>
                  </div>
                </td>
                <td>
                  <div className="user-info">
                    <span className="user-name">{route.userName}</span>
                  </div>
                </td>
                <td>{route.startPoint}</td>
                <td>{route.endPoint}</td>
                <td>{route.preferredTime || "N/A"}</td>
                <td>
                  <div className="votes">
                    <span className="vote-count">{route.votes}</span>
                    <span className="vote-label">
                      {route.votes === 1 ? "commuter" : "commuters"}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="partner-cell">
                    <span className="partner-count">
                      {route.interestedCount || 0}
                    </span>
                    <span className="vote-label">
                      {route.publishedCount > 0
                        ? `${route.publishedCount} published`
                        : "interested"}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(route.status) }}
                  >
                    {route.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="view-btn"
                      onClick={() => handleViewDetails(route)}
                    >
                      View Details
                    </button>
                    {isActionable(route.status) && (
                      <>
                        <button
                          className="approve-btn"
                          onClick={() => openMarketplaceModal(route)}
                        >
                          Open to Partners
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => handleReject(route._id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {isOpened(route.status) && (
                      <button
                        className="approve-btn"
                        onClick={() => openMarketplaceModal(route)}
                      >
                        Notify More
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="no-routes">
          <p>No suggested routes found</p>
        </div>
      )}

      {/* Open to Marketplace Modal */}
      {showOpenModal && routeToOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <h3>Open Route to Partners</h3>
              <button className="close-btn" onClick={closeMarketplaceModal}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <p style={{ marginTop: 0, color: "#6b7280" }}>
                Open <strong>{routeToOpen.routeName}</strong> to B2C partners.
                Each notified partner can publish their own route to serve these{" "}
                <strong>{routeToOpen.votes}</strong> commuter(s). No single
                partner is assigned — commuters pick from whoever publishes a
                route.
              </p>

              {(routeToOpen.interestedPartners || []).length > 0 && (
                <div className="form-group">
                  <label>Partners who already expressed interest</label>
                  <div className="interested-partner-list">
                    {routeToOpen.interestedPartners.map((p) => (
                      <div key={p.partnerId} className="interested-partner-row">
                        <div>
                          <span className="ip-name">{p.name}</span>
                          {p.estimatedPrice != null && (
                            <span className="ip-price">
                              {" "}
                              · est. KWD {Number(p.estimatedPrice).toFixed(2)}
                            </span>
                          )}
                          {p.status === "ROUTE_PUBLISHED" && (
                            <span className="ip-published">
                              {" "}
                              · route published
                            </span>
                          )}
                        </div>
                        {p.message && (
                          <small className="ip-message">{p.message}</small>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={notifyAll}
                    onChange={(e) => setNotifyAll(e.target.checked)}
                  />
                  Notify all active B2C partners
                </label>
                <small style={{ color: "#6b7280" }}>
                  {notifyAll
                    ? "Every active partner will be invited to publish a route."
                    : "Only the partners who already showed interest will be notified."}
                </small>
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={closeMarketplaceModal}>
                  Cancel
                </button>
                <button
                  className="approve-btn"
                  onClick={confirmOpenToMarketplace}
                  disabled={
                    submitting ||
                    (!notifyAll && selectedPartnerIds.length === 0)
                  }
                >
                  {submitting ? "Opening..." : "Open & Notify Partners"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Reject Route Suggestion</h3>
              <button
                className="close-btn"
                onClick={() => setShowRejectModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Rejection Reason:</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="reject-btn"
                  onClick={confirmRejection}
                  disabled={!rejectionReason.trim()}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Details Modal */}
      {showDetailsModal && selectedRouteDetails && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h3>Route Details</h3>
              <button className="close-btn" onClick={closeDetailsModal}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Route Name
                  </span>
                  <span style={{ fontWeight: "600" }}>
                    {selectedRouteDetails.routeName}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Requested By
                  </span>
                  <span>{selectedRouteDetails.userName}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Start Point
                  </span>
                  <span>{selectedRouteDetails.startPoint}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    End Point
                  </span>
                  <span>{selectedRouteDetails.endPoint}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Preferred Time(s)
                  </span>
                  <span>{selectedRouteDetails.preferredTime || "N/A"}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Total Demand
                  </span>
                  <span>
                    {selectedRouteDetails.votes} commuter(s) ·{" "}
                    {selectedRouteDetails.requestCount} request(s)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>
                    Status
                  </span>
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(
                        selectedRouteDetails.status,
                      ),
                    }}
                  >
                    {selectedRouteDetails.status}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      color: "#6b7280",
                      fontWeight: "500",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Interested Partners (
                    {(selectedRouteDetails.interestedPartners || []).length})
                  </span>
                  {(selectedRouteDetails.interestedPartners || []).length ===
                  0 ? (
                    <small style={{ color: "#9ca3af" }}>
                      No partners have expressed interest yet.
                    </small>
                  ) : (
                    <div className="interested-partner-list">
                      {selectedRouteDetails.interestedPartners.map((p) => (
                        <div
                          key={p.partnerId}
                          className="interested-partner-row"
                        >
                          <div>
                            <span className="ip-name">{p.name}</span>
                            {p.estimatedPrice != null && (
                              <span className="ip-price">
                                {" "}
                                · est. KWD {Number(p.estimatedPrice).toFixed(2)}
                              </span>
                            )}
                            {p.status === "ROUTE_PUBLISHED" && (
                              <span className="ip-published">
                                {" "}
                                · route published
                              </span>
                            )}
                          </div>
                          {p.message && (
                            <small className="ip-message">{p.message}</small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: "24px" }}>
                <button className="cancel-btn" onClick={closeDetailsModal}>
                  Close
                </button>
                {(isActionable(selectedRouteDetails.status) ||
                  isOpened(selectedRouteDetails.status)) && (
                  <>
                    <button
                      className="approve-btn"
                      onClick={() => {
                        const r = selectedRouteDetails;
                        closeDetailsModal();
                        openMarketplaceModal(r);
                      }}
                    >
                      {isOpened(selectedRouteDetails.status)
                        ? "Notify More"
                        : "Open to Partners"}
                    </button>
                    {isActionable(selectedRouteDetails.status) && (
                      <button
                        className="reject-btn"
                        onClick={() => {
                          closeDetailsModal();
                          handleReject(selectedRouteDetails._id);
                        }}
                      >
                        Reject
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserSuggestedRoutes;
