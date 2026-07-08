import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import "./AdminOverview.css";
import AdminStatsCards from "../AdminStatsCards/AdminStatsCards";
import AdminRevenueChart from "../AdminRevenueChart/AdminRevenueChart";
import AdminUserDistribution from "../AdminUserDistribution/AdminUserDistribution";
import AdminBookingTrends from "../AdminBookingTrends/AdminBookingTrends";
import api from "../../../utils/api";

function AdminOverview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCorporates: 0,
    totalB2CPartners: 0,
    totalB2BPartners: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeTrips: 0,
    pendingPayments: 0,
    supportTickets: 0,
    activeContracts: 0,
    totalDrivers: 0,
    suspendedUsers: 0,
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [onlinePaymentStatus, setOnlinePaymentStatus] = useState({
    enabled: true,
    lastToggled: null,
    toggledBy: null,
  });

  // The admin's selected view country (driven by the navbar currency selector).
  // When it changes, we refetch all dashboard data scoped to that country so the
  // numbers AND the currency stay in sync.
  const country = useSelector((state) => state.locale?.country);

  useEffect(() => {
    fetchDashboardData();
    fetchRecentActivity();
    fetchOnlinePaymentStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // Live auto-refresh: keep platform KPIs + recent activity current in the
  // background without the admin needing to reload the page.
  const refreshDashboard = useCallback(
    ({ silent } = {}) => {
      fetchDashboardData({ silent });
      fetchRecentActivity();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [country],
  );

  useAutoRefresh(refreshDashboard, {
    interval: 30000,
    socketEvents: ["new-notification"],
    deps: [country],
  });

  const fetchDashboardData = async ({ silent } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      // Fetch dashboard stats scoped to the selected country so revenue, wallet
      // balance and currency all reflect the chosen market.
      const statsResponse = await api.get("/admin/dashboard/stats", {
        params: country ? { country } : {},
      });

      // Fetch recent activity
      const activityResponse = await api.get("/admin/recent-activity");

      // Use stats from the dashboard stats API which now includes all counts
      const dashboardStats = statsResponse.data.stats || {};

      const combinedStats = {
        totalUsers: dashboardStats.totalUsers || 0,
        totalCorporates: dashboardStats.totalCorporates || 0,
        totalB2CPartners: dashboardStats.totalB2CPartners || 0,
        totalB2BPartners: dashboardStats.totalB2BPartners || 0,
        totalBookings: dashboardStats.totalBookings || 0,
        totalRevenue: dashboardStats.totalRevenue || 0,
        activeTrips: dashboardStats.activeTrips || 0,
        pendingPayments: dashboardStats.pendingPayments || 0,
        supportTickets: dashboardStats.supportTickets || 0,
        activeContracts: dashboardStats.activeContracts || 0,
        activeBookings: dashboardStats.activeBookings || 0,
        totalDrivers: dashboardStats.totalDrivers || 0,
        suspendedUsers: dashboardStats.suspendedUsers || 0,
        adminBalance: dashboardStats.adminBalance || 0,
        totalEarnings: dashboardStats.totalEarnings || 0,
        currency: dashboardStats.currency || getActiveCurrency(),
      };

      setStats(combinedStats);
      setRecentActivity(activityResponse.data.recentActivity || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // On a silent background refresh, keep the last good data instead of
      // flashing an error / zeros to the admin.
      if (!silent) {
        setError("Failed to load dashboard data");

        // Set fallback data only on error
        setStats({
          totalUsers: 0,
          totalCorporates: 0,
          totalB2CPartners: 0,
          totalB2BPartners: 0,
          totalBookings: 0,
          totalRevenue: 0,
          activeTrips: 0,
          pendingPayments: 0,
          supportTickets: 0,
          activeContracts: 0,
          totalDrivers: 0,
          suspendedUsers: 0,
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await api.get("/admin/recent-activity");
      setRecentActivity(response.data.recentActivity || []);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      setRecentActivity([]);
    }
  };

  const fetchOnlinePaymentStatus = async () => {
    try {
      const response = await api.get("/admin/payments/online/status");
      setOnlinePaymentStatus(response.data.status);
    } catch (error) {
      console.error("Error fetching online payment status:", error);
    }
  };

  const toggleOnlinePayments = async () => {
    try {
      const response = await api.put("/admin/payments/online/toggle", {
        enabled: !onlinePaymentStatus.enabled,
      });
      setOnlinePaymentStatus({
        ...onlinePaymentStatus,
        enabled: response.data.enabled,
        lastToggled: response.data.lastToggled || new Date(),
        toggledBy: response.data.toggledBy || "System Admin",
      });
    } catch (error) {
      console.error("Error toggling online payments:", error);
      alert("Failed to toggle online payments. Please try again.");
    }
  };

  const _formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: getActiveCurrency(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="drivemego-aot-admin-overview">
        <div className="drivemego-aot-loading-container">
          <div className="drivemego-aot-loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drivemego-aot-admin-overview">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchDashboardData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-aot-admin-overview">
      <div className="overview-header">
        <h2>Dashboard Overview</h2>
        <div className="last-updated">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className="overview-content">
        <div className="stats-section">
          <AdminStatsCards stats={stats} />
        </div>

        <div className="charts-section">
          <div className="charts-grid">
            <div className="chart-container">
              <AdminRevenueChart />
            </div>
            <div className="chart-container">
              <AdminUserDistribution stats={stats} />
            </div>
          </div>

          <div className="chart-container full-width">
            <AdminBookingTrends />
          </div>
        </div>

        <div className="activity-section">
          <div className="pay-control-section">
            <div className="pay-control-header">
              <h3>💳 Payment Control</h3>
              <div
                className={`pay-control-status-badge ${onlinePaymentStatus.enabled ? "enabled" : "disabled"}`}
              >
                {onlinePaymentStatus.enabled ? "ACTIVE" : "INACTIVE"}
              </div>
            </div>
            <div className="pay-control-card">
              <div className="pay-control-status-info">
                <div className="pay-control-status-message">
                  <span
                    className={`pay-control-status-dot ${onlinePaymentStatus.enabled ? "enabled" : "disabled"}`}
                  ></span>
                  <span className="pay-control-status-text">
                    Online payments are{" "}
                    <strong>
                      {onlinePaymentStatus.enabled ? "ENABLED" : "DISABLED"}
                    </strong>
                  </span>
                </div>
                {onlinePaymentStatus.lastToggled && (
                  <div className="pay-control-last-toggled-info">
                    <small>
                      Last updated:{" "}
                      {new Date(
                        onlinePaymentStatus.lastToggled,
                      ).toLocaleString()}
                      by {onlinePaymentStatus.toggledBy}
                    </small>
                  </div>
                )}
              </div>
              <div className="pay-control-actions">
                <button
                  className={`pay-control-toggle-btn ${onlinePaymentStatus.enabled ? "disable" : "enable"}`}
                  onClick={toggleOnlinePayments}
                >
                  {onlinePaymentStatus.enabled ? "DISABLE" : "ENABLE"}
                </button>
              </div>
            </div>
          </div>

          <h3>Recent Activity</h3>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">
                      {activity.action || activity.title}
                    </p>
                    <p className="activity-description">
                      {activity.details || activity.description}
                    </p>
                    <span className="activity-time">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-activity">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const getActivityIcon = (type) => {
  switch (type) {
    case "user":
    case "user_registered":
      return "👤";
    case "payment":
    case "payment_received":
      return "💰";
    case "contract":
    case "contract_signed":
      return "📋";
    case "trip":
    case "trip_completed":
      return "🚌";
    case "support":
    case "support_ticket":
      return "🎫";
    case "booking":
      return "🎫";
    default:
      return "📊";
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return "Just now";

  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / (1000 * 60));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInMinutes < 1440)
    return `${Math.floor(diffInMinutes / 60)} hours ago`;
  return `${Math.floor(diffInMinutes / 1440)} days ago`;
};

export default AdminOverview;
