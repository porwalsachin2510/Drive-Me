"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import "./b2crouterequests.css";

function B2CRouteRequests() {
  const [routeRequests, setRouteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
  });
  const [respondingId, setRespondingId] = useState(null);
  const [responseText, setResponseText] = useState("");

  const socket = useSocket();

  const fetchRouteRequests = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append("page", page);
        if (statusFilter) params.append("status", statusFilter);

        const response = await api.get(
          `/b2c-partner/route-requests?${params.toString()}`,
        );
        if (response.data.success) {
          setRouteRequests(response.data.data.routeRequests || []);
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
        setError("Failed to load route requests");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    fetchRouteRequests();
  }, [fetchRouteRequests]);

  // Listen for real-time notifications about new route requests
  useEffect(() => {
    if (socket.socket) {
      socket.socket.on("notification", (notification) => {
        if (notification.type === "NEW_ROUTE_REQUEST") {
          console.log("New route request notification received:", notification);
          // Refresh the list when a new route request is submitted
          fetchRouteRequests(pagination.currentPage);
        }
      });

      return () => {
        socket.socket.off("notification");
      };
    }
  }, [socket, fetchRouteRequests, pagination.currentPage]);

  const handleRespond = async (requestId, status) => {
    try {
      setRespondingId(requestId);
      const response = await api.put(
        `/b2c-partner/route-requests/${requestId}/respond`,
        {
          status,
          response: responseText,
        },
      );
      if (response.data.success) {
        alert(`Request ${status.toLowerCase()} successfully`);
        setResponseText("");
        setRespondingId(null);
        fetchRouteRequests(pagination.currentPage);
      }
    } catch (err) {
      console.error("Error responding to request:", err);
      alert("Failed to respond to request");
    } finally {
      setRespondingId(null);
    }
  };

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
      <div className="drivemego-route-requests-route-requests-loading">
        <div className="drivemego-route-requests-loading-spinner" />
        <p>Loading route requests...</p>
      </div>
    );
  }

  return (
    <div className="route-requests">
      <div className="requests-header">
        <div>
          <h2>Passenger Route Requests</h2>
          <p>Review and respond to new route requests from passengers</p>
        </div>
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="">All Requests</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="requests-error">
          <p>{error}</p>
          <button onClick={() => fetchRouteRequests()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {routeRequests.length === 0 ? (
        <div className="empty-requests">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#adb5bd"
            strokeWidth="1.5"
          >
            <path d="M4 4H20V16H8L4 20V4Z" strokeLinejoin="round" />
            <path d="M8 9H16" strokeLinecap="round" />
            <path d="M8 12H12" strokeLinecap="round" />
          </svg>
          <h3>No Route Requests</h3>
          <p>When passengers request new routes, they will appear here.</p>
        </div>
      ) : (
        <div className="requests-list">
          {routeRequests.map((request) => {
            const statusBadge = getStatusBadge(request.status);
            return (
              <div key={request._id} className="request-card">
                <div className="request-card-header">
                  <div className="route-info">
                    <h3>
                      {request.pickupLocation} &rarr; {request.dropoffLocation}
                    </h3>
                    <p className="request-date">
                      Requested on {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: statusBadge.bg,
                      color: statusBadge.color,
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                <div className="request-details">
                  <div className="detail-row">
                    <span className="detail-label">Passenger</span>
                    <span className="detail-value">
                      {request.passengerId?.fullName || "Anonymous"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Contact</span>
                    <span className="detail-value">
                      {request.passengerId?.email || "N/A"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Preferred Time</span>
                    <span className="detail-value">
                      {request.preferredTime}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Request Type</span>
                    <span className="detail-value">{request.requestType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Travel Days</span>
                    <span className="detail-value">
                      {(request.travelDays || []).join(", ")}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Start Date</span>
                    <span className="detail-value">
                      {formatDate(request.expectedStartDate)}
                    </span>
                  </div>
                  {request.demandCount > 1 && (
                    <div className="detail-row">
                      <span className="detail-label">Demand Count</span>
                      <span className="detail-value demand-badge">
                        {request.demandCount} passengers
                      </span>
                    </div>
                  )}
                </div>

                {request.status === "PENDING" && (
                  <div className="request-actions">
                    <div className="response-input">
                      <input
                        type="text"
                        placeholder="Add a response message (optional)..."
                        value={respondingId === request._id ? responseText : ""}
                        onChange={(e) => {
                          setRespondingId(request._id);
                          setResponseText(e.target.value);
                        }}
                        className="response-field"
                      />
                    </div>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleRespond(request._id, "APPROVED")}
                        disabled={respondingId === request._id}
                        className="btn-approve"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRespond(request._id, "REJECTED")}
                        disabled={respondingId === request._id}
                        className="btn-reject"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {request.providerResponse && (
                  <div className="provider-response">
                    <strong>Your Response:</strong> {request.providerResponse}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={pagination.currentPage <= 1}
            onClick={() => fetchRouteRequests(pagination.currentPage - 1)}
            className="page-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.currentPage} of {pagination.totalPages} (
            {pagination.total} total)
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => fetchRouteRequests(pagination.currentPage + 1)}
            className="page-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default B2CRouteRequests;
