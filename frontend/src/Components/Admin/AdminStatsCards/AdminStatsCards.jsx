import { getActiveCurrency } from "../../../config/localeConfig";
import "./AdminStatsCards.css";

function AdminStatsCards({ stats }) {
  const statsData = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+12% this month",
      positive: true,
      icon: "👥",
      color: "#10b981",
    },
    {
      title: "Corporate Clients",
      value: stats?.totalCorporates || 0,
      change: `${stats?.activeContracts || 0} active contracts`,
      positive: true,
      icon: "🏢",
      color: "#3b82f6",
    },
    {
      title: "B2C Partners",
      value: stats?.totalB2CPartners || 0,
      change: `${stats?.activeBookings || 0} active bookings`,
      positive: true,
      icon: "🚐",
      color: "#8b5cf6",
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings || 0,
      change: "+23% this month",
      positive: true,
      icon: "📅",
      color: "#f59e0b",
    },
    {
      title: "Total Revenue",
      value:
        stats?.totalRevenue !== undefined
          ? `${stats.currency || getActiveCurrency()} ${Number(stats.totalRevenue).toLocaleString()}`
          : `${stats.currency || getActiveCurrency()} 0`,
      change: "+18% this month",
      positive: true,
      icon: "💰",
      color: "#10b981",
    },
    {
      title: "Admin Wallet Balance",
      value:
        stats?.adminBalance !== undefined
          ? `${stats.currency || getActiveCurrency()} ${Number(stats.adminBalance).toLocaleString()}`
          : `${stats.currency || getActiveCurrency()} 0`,
      change: `Total Earnings: ${stats.currency || getActiveCurrency()} ${Number(stats?.totalEarnings || 0).toLocaleString()}`,
      positive: true,
      icon: "💳",
      color: "#059669",
    },
    {
      title: "Active Trips",
      value: stats?.activeTrips || 0,
      change: "Live now",
      positive: true,
      icon: "🚌",
      color: "#ef4444",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments || 0,
      change: "Awaiting verification",
      positive: false,
      icon: "⏳",
      color: "#f59e0b",
    },
  ];

  return (
    <div className="ad-dash-stats-grid">
      {statsData.map((stat, index) => (
        <div key={index} className="ad-dash-stat-card">
          <div className="ad-dash-stat-content">
            <div className="ad-dash-stat-header">
              <span className="ad-dash-stat-title">{stat.title}</span>
              <span
                className="ad-dash-stat-icon"
                style={{
                  backgroundColor: `${stat.color}20`,
                  color: stat.color,
                }}
              >
                {stat.icon}
              </span>
            </div>
            <div className="ad-dash-stat-value">{stat.value}</div>
            <div
              className={`ad-dash-stat-change ${stat.positive ? "ad-dash-stat-positive" : "ad-dash-stat-negative"}`}
            >
              {stat.positive && "↗ "}
              {stat.change}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminStatsCards;
