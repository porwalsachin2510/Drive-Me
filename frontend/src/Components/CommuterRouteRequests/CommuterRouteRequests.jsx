"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../../hooks/useSocket";
import api from "../../utils/api";
import "./CommuterRouteRequests.css";

function CommuterRouteRequests() {
  const [routeRequests, setRouteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
  });
  const socket = useSocket();

  const fetchRouteRequests = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append("page", page);
        if (statusFilter) params.append("status", statusFilter);

        const response = await api.get(
          `/route-requests/my-requests?${params.toString()}`,
        );
        if (response.data.success) {
          setRouteRequests(response.data.data.requests || []);
          setPagination(
            response.data.data.pagination || {
              currentPage: 1,
              totalPages: 1,
              total: 0,
            },
          );
        }
      } catch (err) {
        console.error("Error fetching route requests:", err);
        setError("Failed to load your route requests");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    fetchRouteRequests();
  }, [fetchRouteRequests]);

  // Listen for real-time updates on route request status
  useEffect(() => {
    if (socket.socket) {
      socket.socket.on("ROUTE_REQUEST_UPDATED", (data) => {
        console.log("Route request updated:", data);
        // Refresh the list when a route request is updated
        fetchRouteRequests(pagination.currentPage);
      });

      socket.socket.on("notification", (notification) => {
        if (notification.type === "ROUTE_REQUEST_RESPONSE") {
          console.log("Route request response received:", notification);
          fetchRouteRequests(pagination.currentPage);
        }
      });

      return () => {
        socket.socket.off("ROUTE_REQUEST_UPDATED");
        socket.socket.off("notification");
      };
    }
  }, [socket, fetchRouteRequests, pagination.currentPage]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      PENDING: { bg: "#fff3e0", color: "#e65100", label: "Pending" },
      UNDER_REVIEW: { bg: "#e8f4fd", color: "#0d6efd", label: "Under Review" },
      APPROVED: { bg: "#e8f8ee", color: "#198754", label: "Approved" },
      REJECTED: { bg: "#fce4ec", color: "#d32f2f", label: "Rejected" },
      COMPLETED: { bg: "#e0f7fa", color: "#00838f", label: "Completed" },
    };
    return config[status] || { bg: "#f5f5f5", color: "#666", label: status };
  };

  if (loading) {
    return (
      <div className="drivemego-commuter-route-requests-loading">
        <div className="drivemego-loading-spinner" />
        <p>Loading your route requests...</p>
      </div>
    );
  }

  return (
    <div className="drivemego-commuter-route-requests">
      <div className="drivemego-commuter-route-requests-header">
        <div>
          <h2>My Route Requests</h2>
          <p>Track the status of your route requests</p>
        </div>
        <div className="drivemego-filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="drivemego-status-filter"
          >
            <option value="">All Requests</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="drivemego-commuter-route-requests-error">
          <p>{error}</p>
          <button
            onClick={() => fetchRouteRequests()}
            className="drivemego-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {routeRequests.length === 0 ? (
        <div className="drivemego-empty-requests">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#adb5bd"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 00-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" />
          </svg>
          <h3>No Route Requests</h3>
          <p>
            {
              "You haven't requested any routes yet. When you can't find a route, use the \"Request a Route\" option to let transport providers know about your needs."
            }
          </p>
        </div>
      ) : (
        <div className="drivemego-commuter-route-requests-list">
          {routeRequests.map((request) => {
            const statusBadge = getStatusBadge(request.status);
            return (
              <div
                key={request._id}
                className="drivemego-commuter-route-request-card"
              >
                <div className="drivemego-request-card-header">
                  <div className="drivemego-route-info">
                    <h3>
                      {request.pickupLocation} &rarr; {request.dropoffLocation}
                    </h3>
                    <p className="drivemego-request-date">
                      Requested on {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <span
                    className="drivemego-status-badge"
                    style={{
                      backgroundColor: statusBadge.bg,
                      color: statusBadge.color,
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                <div className="drivemego-request-details">
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Preferred Time
                    </span>
                    <span className="drivemego-detail-value">
                      {request.preferredTime}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Request Type</span>
                    <span className="drivemego-detail-value">
                      {request.requestType}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Travel Days</span>
                    <span className="drivemego-detail-value">
                      {(request.travelDays || []).join(", ")}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Expected Start Date
                    </span>
                    <span className="drivemego-detail-value">
                      {formatDate(request.expectedStartDate)}
                    </span>
                  </div>
                  {request.demandCount > 1 && (
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">
                        Similar Requests
                      </span>
                      <span className="drivemego-detail-value drivemego-demand-badge">
                        {request.demandCount} passengers want this route
                      </span>
                    </div>
                  )}
                </div>

                {request.providerResponse && (
                  <div
                    className={`drivemego-provider-response ${request.status === "APPROVED" ? "drivemego-approved" : request.status === "REJECTED" ? "drivemego-rejected" : ""}`}
                  >
                    <strong>Provider Response:</strong>{" "}
                    {request.providerResponse}
                    {request.assignedProviderId && (
                      <div className="drivemego-provider-info">
                        <span>
                          Provider:{" "}
                          {request.assignedProviderId.fullName ||
                            request.assignedProviderId.companyName ||
                            "Transport Provider"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {request.estimatedPrice && (
                  <div className="drivemego-estimated-price">
                    <strong>Estimated Price:</strong> AED{" "}
                    {request.estimatedPrice}
                  </div>
                )}

                {request.status === "APPROVED" && (
                  <div className="drivemego-approved-actions">
                    <p className="drivemego-success-message">
                      Your route request has been approved! The provider will
                      create a route for you soon.
                    </p>
                  </div>
                )}

                {request.status === "REJECTED" && (
                  <div className="drivemego-rejected-info">
                    <p>
                      Unfortunately, no providers can fulfill this route at this
                      time. Try modifying your request or check back later.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="drivemego-pagination">
          <button
            disabled={pagination.currentPage <= 1}
            onClick={() => fetchRouteRequests(pagination.currentPage - 1)}
            className="drivemego-page-btn"
          >
            Previous
          </button>
          <span className="drivemego-page-info">
            Page {pagination.currentPage} of {pagination.totalPages} (
            {pagination.totalRequests || pagination.total} total)
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => fetchRouteRequests(pagination.currentPage + 1)}
            className="drivemego-page-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default CommuterRouteRequests;
