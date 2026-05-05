"use client";
import "./b2b_navigation.css";

function B2B_Navigation({ b2bactiveTab, setB2BActiveTab }) {
  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "fleet", label: "Fleet & Drivers", icon: "🚗" },
    { id: "contracts", label: "Contracts", icon: "📄" },
    { id: "My Quotation", label: "My Quotation", icon: "📄" },
    { id: "negotiations", label: "Negotiations", icon: "negotiation" },
    { id: "requirements", label: "Requirements", icon: "📋" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "invoices", label: "Invoices", icon: "💰" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <nav className="b2b-navigation">
      <div className="b2b-nav-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`b2b-nav-tab ${
              b2bactiveTab === tab.id ? "b2b-active" : ""
            }`}
            onClick={() => setB2BActiveTab(tab.id)}
          >
            <span className="b2b-nav-icon">{tab.icon}</span>
            <span className="b2b-nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default B2B_Navigation;
