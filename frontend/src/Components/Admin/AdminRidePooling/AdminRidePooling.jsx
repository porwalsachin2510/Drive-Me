"use client";

import { useState, useEffect } from "react";
import { Users, Route, Lightbulb, GitMerge, Waypoints } from "lucide-react";
import "./AdminRidePooling.css";
import AdminPassengerInterests from "./AdminPassengerInterests/AdminPassengerInterests";
import AdminUserSuggestedRoutes from "./AdminUserSuggestedRoutes/AdminUserSuggestedRoutes";
import api from "../../../utils/api";

function AdminRidePooling() {
  const [activeSubTab, setActiveSubTab] = useState("passenger-interests");
  const [stats, setStats] = useState({
    totalPassengers: 0,
    activeRoutes: 0,
    suggestedRoutes: 0,
    matchedRides: 0,
  });

  const fetchRidePoolingStats = async () => {
    try {
      const response = await api.get("/admin/ride-pooling/stats");
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching ride pooling stats:", error);
    }
  };

  useEffect(() => {
    fetchRidePoolingStats();
  }, []);

  const renderSubContent = () => {
    switch (activeSubTab) {
      case "passenger-interests":
        return <AdminPassengerInterests />;
      case "user-suggested-routes":
        return <AdminUserSuggestedRoutes />;
      default:
        return <AdminPassengerInterests />;
    }
  };

  const statCards = [
    { icon: Users, label: "Total Passengers", value: stats.totalPassengers },
    { icon: Route, label: "Active Routes", value: stats.activeRoutes },
    { icon: Lightbulb, label: "Suggested Routes", value: stats.suggestedRoutes },
    { icon: GitMerge, label: "Matched Rides", value: stats.matchedRides },
  ];

  return (
    <div className="admin-ride-pooling">
      <div className="ride-pooling-header">
        <div className="rp-header-top">
          <div className="rp-header-icon">
            <Waypoints size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h2>Ride Pooling Management</h2>
            <p className="rp-subtitle">
              Track commuter interest, review user-suggested routes, and match
              riders into shared trips.
            </p>
          </div>
        </div>

        <div className="ride-pooling-stats">
          {statCards.map(({ icon: Icon, label, value }) => (
            <div className="stat-item" key={label}>
              <div className="rp-stat-icon">
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <div className="rp-stat-text">
                <span className="stat-number">{value}</span>
                <span className="stat-label">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ride-pooling-tabs">
        <button
          className={`ride-pooling-tab ${activeSubTab === "passenger-interests" ? "active" : ""}`}
          onClick={() => setActiveSubTab("passenger-interests")}
        >
          <Users size={16} />
          Passenger Interests
        </button>
        <button
          className={`ride-pooling-tab ${activeSubTab === "user-suggested-routes" ? "active" : ""}`}
          onClick={() => setActiveSubTab("user-suggested-routes")}
        >
          <Route size={16} />
          User Suggested Routes
        </button>
      </div>

      <div className="ride-pooling-content">{renderSubContent()}</div>
    </div>
  );
}

export default AdminRidePooling;
