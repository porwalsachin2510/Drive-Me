"use client"
import {
  LayoutDashboard,
  Bus,
  Car,
  ClipboardList,
  Users,
  Wallet,
  BadgeCheck,
  CreditCard,
  ListFilter,
  TrendingUp,
  Banknote,
  MessageSquare,
  Megaphone,
  ReceiptText,
  FileText,
} from "lucide-react";
import "./AdminNavigation.css"

function AdminNavigation({ dashboardactiveTab, setDashboardActiveTab }) {
  const navItems = [
    { id: "overview", label: "Overview", Icon: LayoutDashboard },
    { id: "b2c", label: "B2C Management", Icon: Bus },
    { id: "ride-pooling", label: "Ride Pooling", Icon: Car },
    { id: "b2b", label: "B2B Listings", Icon: ClipboardList },
    { id: "users", label: "Users", Icon: Users },
    { id: "wallets", label: "Wallets", Icon: Wallet },
    { id: "vehicle-approval", label: "Vehicle Approval", Icon: BadgeCheck },
    { id: "settlement", label: "Settlement", Icon: CreditCard },
    { id: "dropdowns", label: "Dropdowns", Icon: ListFilter },
    { id: "reports", label: "Reports", Icon: TrendingUp },
    { id: "finance", label: "Finance", Icon: Banknote },
    { id: "comm", label: "Comm.", Icon: MessageSquare },
    { id: "ads", label: "Ads", Icon: Megaphone },
    { id: "Payment Verification", label: "Payment Verification", Icon: ReceiptText },
    { id: "content", label: "Content", Icon: FileText },
  ];

  return (
    <nav className="ad-dash-navigation">
      <div className="ad-dash-nav-content">
        {navItems.map((item) => {
          const { Icon } = item;
          return (
            <button
              key={item.id}
              className={`ad-dash-nav-item ${
                dashboardactiveTab === item.id ? "ad-dash-nav-item-active" : ""
              }`}
              onClick={() => setDashboardActiveTab(item.id)}
            >
              <span className="ad-dash-nav-icon">
                <Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="ad-dash-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default AdminNavigation
