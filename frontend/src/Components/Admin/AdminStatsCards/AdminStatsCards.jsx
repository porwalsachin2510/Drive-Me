import { getActiveCurrency } from "../../../config/localeConfig";
import "./AdminStatsCards.css";

const ICONS = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  corporate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  van: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
      <circle cx="6.5" cy="16.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  revenue: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 10H18a2 2 0 0 0 0 4h4" />
    </svg>
  ),
  trips: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

function AdminStatsCards({ stats }) {
  const statsData = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+12% this month",
      positive: true,
      icon: "users",
      tone: "teal",
    },
    {
      title: "Corporate Clients",
      value: stats?.totalCorporates || 0,
      change: `${stats?.activeContracts || 0} active contracts`,
      positive: true,
      icon: "corporate",
      tone: "navy",
    },
    {
      title: "B2C Partners",
      value: stats?.totalB2CPartners || 0,
      change: `${stats?.activeBookings || 0} active bookings`,
      positive: true,
      icon: "van",
      tone: "violet",
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings || 0,
      change: "+23% this month",
      positive: true,
      icon: "calendar",
      tone: "amber",
    },
    {
      title: "Total Revenue",
      value:
        stats?.totalRevenue !== undefined
          ? `${stats.currency || getActiveCurrency()} ${Number(stats.totalRevenue).toLocaleString()}`
          : `${stats.currency || getActiveCurrency()} 0`,
      change: "+18% this month",
      positive: true,
      icon: "revenue",
      tone: "green",
    },
    {
      title: "Admin Wallet Balance",
      value:
        stats?.adminBalance !== undefined
          ? `${stats.currency || getActiveCurrency()} ${Number(stats.adminBalance).toLocaleString()}`
          : `${stats.currency || getActiveCurrency()} 0`,
      change: `Total Earnings: ${stats.currency || getActiveCurrency()} ${Number(stats?.totalEarnings || 0).toLocaleString()}`,
      positive: true,
      icon: "wallet",
      tone: "teal",
    },
    {
      title: "Active Trips",
      value: stats?.activeTrips || 0,
      change: "Live now",
      positive: true,
      icon: "trips",
      tone: "navy",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments || 0,
      change: "Awaiting verification",
      positive: false,
      icon: "clock",
      tone: "amber",
    },
  ];

  return (
    <div className="ad-dash-stats-grid">
      {statsData.map((stat, index) => (
        <div key={index} className="ad-dash-stat-card">
          <div className="ad-dash-stat-content">
            <div className="ad-dash-stat-header">
              <span className="ad-dash-stat-title">{stat.title}</span>
              <span className={`ad-dash-stat-icon tone-${stat.tone}`}>
                {ICONS[stat.icon]}
              </span>
            </div>
            <div className="ad-dash-stat-value">{stat.value}</div>
            <div
              className={`ad-dash-stat-change ${stat.positive ? "ad-dash-stat-positive" : "ad-dash-stat-negative"}`}
            >
              {stat.positive && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              )}
              {stat.change}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminStatsCards;
