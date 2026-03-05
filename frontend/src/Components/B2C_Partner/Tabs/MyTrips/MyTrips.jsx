"use client";

import { useState } from "react";
import NewRequests from "../../MyTripsSub/NewRequests/NewRequests";
import ActiveTrips from "../../MyTripsSub/ActiveTrips/ActiveTrips";
import MyTripsHistory from "../../MyTripsSub/MyTripsHistory/MyTripsHistory";
import "./mytrips.css";

function MyTrips() {
  const [subTab, setSubTab] = useState("new");

  const renderSubContent = () => {
    switch (subTab) {
      case "new":
        return <NewRequests />;
      case "active":
        return <ActiveTrips />;
      case "history":
        return <MyTripsHistory />;
      default:
        return <NewRequests />;
    }
  };

  return (
    <div className="my-trips">
      <div className="trips-sub-tabs">
        <button
          className={`sub-tab-btn ${subTab === "new" ? "active" : ""}`}
          onClick={() => setSubTab("new")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 4V8M8 8H12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          New Requests
        </button>

        <button
          className={`sub-tab-btn ${subTab === "active" ? "active" : ""}`}
          onClick={() => setSubTab("active")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2C4.7 2 2 4.7 2 8C2 11.3 4.7 14 8 14C11.3 14 14 11.3 14 8C14 4.7 11.3 2 8 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 5V8L10.5 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Active Trips
        </button>

        <button
          className={`sub-tab-btn ${subTab === "history" ? "active" : ""}`}
          onClick={() => setSubTab("history")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 4V8L11 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          History
        </button>
      </div>

      <div className="trips-content">{renderSubContent()}</div>
    </div>
  );
}

export default MyTrips;
