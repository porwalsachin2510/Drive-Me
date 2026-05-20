"use client";

import { useState } from "react";
import BookingTable from "../../BookingTable/BookingTable";
import MyTripsHistory from "../../MyTripsSub/MyTripsHistory/MyTripsHistory";
import "./mytrips.css";

/**
 * MyTrips - Main trips management tab for B2C Partner
 * Now uses table-based booking view (like B2C_PARTNER_DRIVER Bookings Tab)
 * with sub-tabs for All Bookings and History
 */
function MyTrips() {
  const [subTab, setSubTab] = useState("all");

  const renderSubContent = () => {
    switch (subTab) {
      case "all":
        return <BookingTable />;
      case "history":
        return <MyTripsHistory />;
      default:
        return <BookingTable />;
    }
  };

  return (
    <div className="my-trips">
      <div className="trips-sub-tabs">
        <button
          className={`sub-tab-btn ${subTab === "all" ? "active" : ""}`}
          onClick={() => setSubTab("all")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="2"
              y="3"
              width="12"
              height="10"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M5 3V2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M11 3V2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          All Bookings
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
