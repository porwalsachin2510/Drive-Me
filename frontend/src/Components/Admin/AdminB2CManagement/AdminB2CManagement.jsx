"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import "./AdminB2CManagement.css";
import AdminServiceProviders from "./AdminServiceProviders/AdminServiceProviders";
import AdminRouteManagement from "./AdminRouteManagement/AdminRouteManagement";
import AdminTagsBadges from "./AdminTagsBadges/AdminTagsBadges";
import AdminPassengersReassignments from "./AdminPassengersReassignments/AdminPassengersReassignments";
import AdminEarningsPayments from "./AdminEarningsPayments/AdminEarningsPayments";
import api from "../../../utils/api";

function AdminB2CManagement() {
  const [activeSubTab, setActiveSubTab] = useState("service-providers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalProviders: 0,
    activeProviders: 0,
    totalRoutes: 0,
    activeRoutes: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalPassengerBookings: 0,
    activeTags: 0,
  });

  // The admin's selected display currency (drives all amount conversions).
  const activeCurrency = useSelector((state) => state.locale?.currency);

  // Re-fetch whenever the admin switches the dashboard currency so the headline
  // figures come back converted into the newly selected currency — no manual
  // page refresh required (mirrors the other admin tabs).
  useEffect(() => {
    fetchB2CStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurrency]);

  const fetchB2CStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/admin/b2c/stats");

      if (response.data.success) {
        const data = response.data.stats;
        setStats({
          totalProviders: data.providers?.totalProviders || 0,
          activeProviders: data.providers?.activeProviders || 0,
          totalRoutes: data.routes?.totalRoutes || 0,
          activeRoutes: data.routes?.activeRoutes || 0,
          totalBookings: data.bookings?.totalBookings || 0,
          totalRevenue: data.bookings?.totalRevenue || 0,
          totalPassengerBookings: data.passengers?.totalPassengerBookings || 0,
          activeTags: data.tags?.activeTags || 0,
        });
      } else {
        throw new Error(response.data.message || "Failed to fetch B2C stats");
      }
    } catch (error) {
      console.error("Error fetching B2C stats:", error);
      setError(error.message || "Failed to load B2C statistics");
      // Set fallback data
      setStats({
        totalProviders: 0,
        activeProviders: 0,
        totalRoutes: 0,
        activeRoutes: 0,
        totalBookings: 0,
        totalRevenue: 0,
        totalPassengerBookings: 0,
        activeTags: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: activeCurrency || getActiveCurrency(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const subTabs = [
    {
      id: "service-providers",
      label: "Service Providers",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></svg>
      ),
      count: stats.activeProviders,
    },
    {
      id: "route-management",
      label: "Route Management",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>
      ),
      count: stats.activeRoutes,
    },
    {
      id: "tags-badges",
      label: "Tags & Badges",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
      ),
      count: stats.activeTags,
    },
    {
      id: "passengers",
      label: "Passengers & Bookings",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      ),
      count: stats.totalPassengerBookings,
    },
    {
      id: "earnings",
      label: "Earnings & Payments",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
      ),
      count: null,
    },
  ];

  const renderSubContent = () => {
    switch (activeSubTab) {
      case "service-providers":
        return <AdminServiceProviders />;
      case "route-management":
        return <AdminRouteManagement />;
      case "tags-badges":
        return <AdminTagsBadges />;
      case "passengers":
        return <AdminPassengersReassignments />;
      case "earnings":
        return <AdminEarningsPayments />;
      default:
        return <AdminServiceProviders />;
    }
  };

  if (loading) {
    return (
      <div className="ad-dash-b2c-management">
        <div className="ad-dash-b2c-loading">
          <div className="ad-dash-b2c-loading-spinner"></div>
          <p>Loading B2C Management...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ad-dash-b2c-management">
        <div className="ad-dash-b2c-error">
          <div className="ad-dash-b2c-error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <div className="ad-dash-b2c-error-title">Error Loading Data</div>
          <div className="ad-dash-b2c-error-message">{error}</div>
          <button className="ad-dash-b2c-retry-btn" onClick={fetchB2CStats}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-dash-b2c-management">
      <div className="ad-dash-b2c-header">
        <div className="ad-dash-b2c-title-section">
          <span className="ad-dash-b2c-eyebrow">B2C Operations</span>
          <h2 className="ad-dash-b2c-title">B2C Management Console</h2>
          <p className="ad-dash-b2c-description">
            Comprehensive control over providers, routes, passengers, and B2C
            financials.
          </p>
        </div>

        <div className="ad-dash-b2c-stats">
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <span className="stat-number">{stats.totalProviders}</span>
            <span className="stat-label">Total Providers</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>
            </div>
            <span className="stat-number">{stats.activeRoutes}</span>
            <span className="stat-label">Active Routes</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 3" /></svg>
            </div>
            <span className="stat-number">
              {stats.totalBookings.toLocaleString()}
            </span>
            <span className="stat-label">Total Bookings</span>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <span className="stat-number">
              {formatCurrency(stats.totalRevenue)}
            </span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      <div className="ad-dash-b2c-tabs">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            className={`ad-dash-b2c-tab ${activeSubTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            <span className="ad-dash-b2c-tab-icon">{tab.icon}</span>
            {tab.label}
            {tab.count !== null && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ad-dash-b2c-content">{renderSubContent()}</div>
    </div>
  );
}

export default AdminB2CManagement;
