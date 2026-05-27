"use client";
import "./b2c_navigation.css";

function B2C_Navigation({ b2cactiveTab, setB2CActiveTab }) {
  const tabs = [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "trips", label: "My Trips", icon: "trips" },
    { id: "earnings", label: "Earnings", icon: "earnings" },
    { id: "vehicles", label: "Fleet", icon: "vehicles" },
    { id: "routes", label: "Routes", icon: "routes" },
    { id: "route-requests", label: "Requests", icon: "requests" },
    { id: "ratings", label: "My Ratings", icon: "ratings" },
    { id: "account", label: "Account", icon: "account" },
  ];

  

  const getIcon = (iconType) => {
    switch (iconType) {
      case "trips":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 3H6V6H3V3Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 3H12V6H9V3Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 9H6V12H3V9Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 9H12V12H9V9Z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "earnings":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 1C4.59 1 1 4.59 1 9C1 13.41 4.59 17 9 17C13.41 17 17 13.41 17 9C17 4.59 13.41 1 9 1Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M9 5.5V12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M6 7.5H12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "vehicles":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 9H16" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M3 9L4 5C4.5 3 5 2 7 2H11C13 2 13.5 3 14 5L15 9"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx="5.5"
              cy="12"
              r="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx="12.5"
              cy="12"
              r="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        );
      case "routes":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 7L9 3L15 7V14C15 14.5523 14.5523 15 14 15H4C3.44772 15 3 14.5523 3 14V7Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M7 15V9H11V15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "overview":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect
              x="2"
              y="2"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="10"
              y="2"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="2"
              y="10"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="10"
              y="10"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        );
      case "requests":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 3H15V13H7L3 16V3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7 7H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M7 10H9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "ratings":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 1L11.2 6.3L17 7L12.8 11L14 17L9 14L4 17L5.2 11L1 7L6.8 6.3L9 1Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "account":
        return (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle
              cx="9"
              cy="6"
              r="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M3 15C3 12.5 5.7 11 9 11C12.3 11 15 12.5 15 15"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <nav className="b2c-navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${b2cactiveTab === tab.id ? "active" : ""}`}
          onClick={() => setB2CActiveTab(tab.id)}
        >
          <span className="nav-icon">{getIcon(tab.icon)}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default B2C_Navigation;
