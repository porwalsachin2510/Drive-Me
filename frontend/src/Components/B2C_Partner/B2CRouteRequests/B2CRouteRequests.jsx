"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../../../hooks/useSocket";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
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
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const socket = useSocket();

  const fetchRouteRequests = useCallback(
    async (page = 1, { silent } = {}) => {
      try {
        if (!silent) setLoading(true);
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
        if (!silent) setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    fetchRouteRequests();
  }, [fetchRouteRequests]);

  // Live auto-refresh: poll in the background so newly-opened demand and
  // interest counts stay current even if a socket event is missed.
  const refreshRouteRequests = useCallback(
    ({ silent } = {}) => fetchRouteRequests(pagination.currentPage, { silent }),
    [fetchRouteRequests, pagination.currentPage],
  );

  useAutoRefresh(refreshRouteRequests, {
    interval: 25000,
    socketEvents: ["new-notification"],
    deps: [statusFilter, pagination.currentPage],
  });

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

  const handleExpressInterest = async (requestId, withdraw = false) => {
    try {
      setSubmitting(true);
      const response = await api.put(
        `/b2c-partner/route-requests/${requestId}/respond`,
        {
          // "REJECTED" tells the backend to withdraw this partner's interest.
          status: withdraw ? "REJECTED" : "INTERESTED",
          response: responseText,
          estimatedPrice: withdraw ? undefined : estimatedPrice,
        },
      );
      if (response.data.success) {
        alert(
          withdraw
            ? "Interest withdrawn."
            : "Interest submitted. The admin reviews demand and opens routes to all interested partners.",
        );
        setResponseText("");
        setEstimatedPrice("");
        setRespondingId(null);
        fetchRouteRequests(pagination.currentPage);
      }
    } catch (err) {
      console.error("Error expressing interest:", err);
      alert(err.response?.data?.message || "Failed to submit interest");
    } finally {
      setSubmitting(false);
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
      PENDING: { bg: "#fff3e0", color: "#e65100", label: "New Demand" },
      UNDER_REVIEW: {
        bg: "#e8f4fd",
        color: "#0d6efd",
        label: "Partners Interested",
      },
      OPEN: { bg: "#e0f2fe", color: "#0369a1", label: "Open to Partners" },
      APPROVED: { bg: "#e8f8ee", color: "#198754", label: "Approved" },
      FULFILLED: { bg: "#e8f8ee", color: "#198754", label: "Fulfilled" },
      REJECTED: { bg: "#fce4ec", color: "#d32f2f", label: "Closed" },
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
          <h2>Open Route Demand</h2>
          <p>
            Express interest in passenger demand. The admin opens routes to
            every interested partner &mdash; publish a route to win these
            riders.
          </p>
        </div>
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="">All Demand</option>
            <option value="PENDING">New Demand</option>
            <option value="UNDER_REVIEW">Partners Interested</option>
            <option value="OPEN">Open to Partners</option>
            <option value="FULFILLED">Fulfilled</option>
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

                {(request.interestedCount > 0 || request.myInterestStatus) && (
                  <div className="interest-summary">
                    <span className="interest-count">
                      {request.interestedCount || 0} partner
                      {request.interestedCount === 1 ? "" : "s"} interested
                    </span>
                    {request.myInterestStatus === "ROUTE_PUBLISHED" && (
                      <span className="my-interest published">
                        You published a route
                      </span>
                    )}
                    {request.myInterestStatus === "INTERESTED" && (
                      <span className="my-interest">
                        You expressed interest
                      </span>
                    )}
                  </div>
                )}

                {request.myInterestStatus === "ROUTE_PUBLISHED" ? (
                  <div className="provider-response">
                    You&apos;ve already published a route for this demand. It is
                    now available for commuters to book, so no further action is
                    needed here.
                  </div>
                ) : ["FULFILLED", "COMPLETED", "REJECTED"].includes(
                    request.status,
                  ) ? (
                  <div className="provider-response">
                    {request.status === "FULFILLED"
                      ? "A route has already been published for this demand, so it is no longer open for interest."
                      : request.status === "REJECTED"
                        ? "This demand has been closed by the admin."
                        : "This demand is completed."}
                  </div>
                ) : request.myInterestStatus === "INTERESTED" ? (
                  <div className="request-actions">
                    <p className="interest-note">
                      You&apos;ve expressed interest. Once the admin opens this
                      route, publish a route from your dashboard to serve these
                      riders.
                    </p>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleExpressInterest(request._id, true)}
                        disabled={submitting}
                        className="btn-reject"
                      >
                        Withdraw Interest
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="request-actions">
                    <div className="response-input interest-inputs">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Estimated price (KWD, optional)"
                        value={
                          respondingId === request._id ? estimatedPrice : ""
                        }
                        onChange={(e) => {
                          setRespondingId(request._id);
                          setEstimatedPrice(e.target.value);
                        }}
                        className="response-field"
                      />
                      <input
                        type="text"
                        placeholder="Add a note to the admin (optional)..."
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
                        onClick={() =>
                          handleExpressInterest(request._id, false)
                        }
                        disabled={submitting}
                        className="btn-approve"
                      >
                        Express Interest
                      </button>
                    </div>
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
