"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/api";
import "./b2cpartneroverview.css";

function B2CPartnerOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renewalData, setRenewalData] = useState(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [showRenewals, setShowRenewals] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2c-partner/dashboard-stats");
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionRenewals = async () => {
    try {
      setRenewalLoading(true);
      const response = await api.get("/b2c-partner/subscription-renewals");
      if (response.data.success) {
        setRenewalData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching subscription renewals:", err);
    } finally {
      setRenewalLoading(false);
    }
  };

  const handleToggleRenewals = () => {
    if (!showRenewals && !renewalData) {
      fetchSubscriptionRenewals();
    }
    setShowRenewals(!showRenewals);
  };

  const getRenewalStatusStyle = (status) => {
    switch (status) {
      case "expired": return { background: "#fce4ec", color: "#c62828", border: "1px solid #ef9a9a" };
      case "expiring_soon": return { background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80" };
      case "renewal_upcoming": return { background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9" };
      case "active": return { background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7" };
      default: return { background: "#f5f5f5", color: "#616161", border: "1px solid #e0e0e0" };
    }
  };

  const getRenewalStatusLabel = (status) => {
    switch (status) {
      case "expired": return "Expired";
      case "expiring_soon": return "Expiring Soon";
      case "renewal_upcoming": return "Renewal Due";
      case "active": return "Active";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="b2c-overview-loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="b2c-overview-error">
        <p>{error}</p>
        <button onClick={fetchDashboardStats} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="b2c-overview">
      <div className="overview-header">
        <h2>Dashboard Overview</h2>
        <p>Real-time stats for your B2C transport service</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-routes">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7L9 3L15 7V14C15 14.5523 14.5523 15 14 15H4C3.44772 15 3 14.5523 3 14V7Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M7 15V9H11V15" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.activeRoutes || 0}</span>
            <span className="stat-label">Active Routes</span>
          </div>
        </div>

        <div className="stat-card stat-subscribers">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="8"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M5 20C5 16.6863 8.13401 14 12 14C15.866 14 19 16.6863 19 20"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.activeSubscribers || 0}</span>
            <span className="stat-label">Active Subscribers</span>
          </div>
        </div>

        <div className="stat-card stat-revenue">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 6V18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M8 10H16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats?.currency || "AED"}{" "}
              {(stats?.monthlyRevenue || 0).toLocaleString()}
            </span>
            <span className="stat-label">Monthly Revenue</span>
          </div>
        </div>

        <div className="stat-card stat-trips">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 2V6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M8 2V6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path d="M3 10H21" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.upcomingTrips || 0}</span>
            <span className="stat-label">Upcoming Trips</span>
          </div>
        </div>

        <div className="stat-card stat-requests">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4H20V16H8L4 20V4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats?.pendingRouteRequests || 0}
            </span>
            <span className="stat-label">Pending Route Requests</span>
          </div>
        </div>

        <div className="stat-card stat-renewals">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.8273 3 17.35 4.30367 19 6.34267"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M21 3V7H17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.renewalsPending || 0}</span>
            <span className="stat-label">Renewals Due (7d)</span>
          </div>
        </div>
      </div>

      {/* Subscribers per Route */}
      {stats?.subscribersPerRoute && stats.subscribersPerRoute.length > 0 && (
        <div className="route-subscribers-section">
          <h3>Subscribers Per Route</h3>
          <div className="route-table">
            <div className="table-header">
              <span>Route</span>
              <span>Active Subscribers</span>
              <span>Total Seats</span>
              <span>Available</span>
              <span>Utilization</span>
            </div>
            {stats.subscribersPerRoute.map((route) => {
              const utilization =
                route.totalSeats > 0
                  ? Math.round(
                      ((route.totalSeats - route.availableSeats) /
                        route.totalSeats) *
                        100,
                    )
                  : 0;
              return (
                <div key={route.routeId} className="table-row">
                  <span className="route-name">{route.routeName}</span>
                  <span className="subscriber-count">
                    {route.activeSubscribers}
                  </span>
                  <span>{route.totalSeats}</span>
                  <span>{route.availableSeats}</span>
                  <span>
                    <div className="utilization-bar">
                      <div
                        className="utilization-fill"
                        style={{ width: `${utilization}%` }}
                      />
                      <span className="utilization-text">{utilization}%</span>
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Summary */}
      <div className="summary-row">
        <div className="summary-card">
          <h4>Total Revenue</h4>
          <p className="summary-value">
            {stats?.currency || "AED"}{" "}
            {(stats?.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="summary-card">
          <h4>Total Subscribers (All Time)</h4>
          <p className="summary-value">{stats?.totalSubscribers || 0}</p>
        </div>
        <div className="summary-card">
          <h4>Total Route Requests</h4>
          <p className="summary-value">{stats?.totalRouteRequests || 0}</p>
        </div>
      </div>

      {/* Subscription Renewals Section */}
      <div className="route-subscribers-section" style={{ marginTop: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: 0 }}>Subscription Renewals</h3>
          <button
            onClick={handleToggleRenewals}
            style={{
              background: showRenewals
                ? "#e0e0e0"
                : "linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)",
              color: showRenewals ? "#333" : "#fff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            {showRenewals ? "Hide Details" : "View Renewal Status"}
          </button>
        </div>

        {showRenewals && (
          <>
            {renewalLoading ? (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <div className="loading-spinner" />
                <p>Loading renewal data...</p>
              </div>
            ) : renewalData ? (
              <>
                {/* Renewal Summary Cards */}
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      ...getRenewalStatusStyle("active"),
                      padding: "12px 20px",
                      borderRadius: "8px",
                      flex: "1",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "700" }}>
                      {renewalData.summary?.active || 0}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "500" }}>
                      Active
                    </div>
                  </div>
                  <div
                    style={{
                      ...getRenewalStatusStyle("expiring_soon"),
                      padding: "12px 20px",
                      borderRadius: "8px",
                      flex: "1",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "700" }}>
                      {renewalData.summary?.expiringSoon || 0}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "500" }}>
                      Expiring Soon
                    </div>
                  </div>
                  <div
                    style={{
                      ...getRenewalStatusStyle("renewal_upcoming"),
                      padding: "12px 20px",
                      borderRadius: "8px",
                      flex: "1",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "700" }}>
                      {renewalData.summary?.renewalUpcoming || 0}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "500" }}>
                      Renewal Due
                    </div>
                  </div>
                  <div
                    style={{
                      ...getRenewalStatusStyle("expired"),
                      padding: "12px 20px",
                      borderRadius: "8px",
                      flex: "1",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "700" }}>
                      {renewalData.summary?.expired || 0}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "500" }}>
                      Expired
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#f3e5f5",
                      color: "#6a1b9a",
                      border: "1px solid #ce93d8",
                      padding: "12px 20px",
                      borderRadius: "8px",
                      flex: "1",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "700" }}>
                      {renewalData.summary?.autoRenewalEnabled || 0}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "500" }}>
                      Auto-Renew On
                    </div>
                  </div>
                </div>

                {/* Renewal Details Table */}
                {renewalData.renewals && renewalData.renewals.length > 0 ? (
                  <div className="route-table">
                    <div
                      className="table-header"
                      style={{
                        gridTemplateColumns: "1.5fr 1.5fr 1fr 0.8fr 1fr 0.8fr",
                      }}
                    >
                      <span>Passenger</span>
                      <span>Route</span>
                      <span>Pass Type</span>
                      <span>Days Left</span>
                      <span>End Date</span>
                      <span>Status</span>
                    </div>
                    {renewalData.renewals.map((renewal) => (
                      <div
                        key={renewal.passId}
                        className="table-row"
                        style={{
                          gridTemplateColumns:
                            "1.5fr 1.5fr 1fr 0.8fr 1fr 0.8fr",
                        }}
                      >
                        <span>
                          {renewal.passenger?.name ||
                            renewal.passenger?.email ||
                            "N/A"}
                        </span>
                        <span style={{ fontSize: "12px" }}>
                          {renewal.route?.fromLocation || "N/A"} to{" "}
                          {renewal.route?.toLocation || "N/A"}
                        </span>
                        <span>
                          {renewal.passType === "ROUND_TRIP"
                            ? "Round Trip"
                            : "One Way"}
                        </span>
                        <span
                          style={{
                            fontWeight: "600",
                            color:
                              renewal.daysRemaining <= 7 ? "#c62828" : "#333",
                          }}
                        >
                          {renewal.daysRemaining}d
                        </span>
                        <span style={{ fontSize: "12px" }}>
                          {new Date(renewal.endDate).toLocaleDateString()}
                        </span>
                        <span>
                          <span
                            style={{
                              ...getRenewalStatusStyle(renewal.renewalStatus),
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              display: "inline-block",
                            }}
                          >
                            {getRenewalStatusLabel(renewal.renewalStatus)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#9e9e9e",
                      padding: "20px",
                    }}
                  >
                    No subscription passes found.
                  </p>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default B2CPartnerOverview;
