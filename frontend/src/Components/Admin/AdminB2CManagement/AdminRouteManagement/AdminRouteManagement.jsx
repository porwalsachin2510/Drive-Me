"use client";

import { getActiveCurrency, getCurrencyDecimals } from "../../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import "./AdminRouteManagement.css";
import api from "../../../../utils/api";

const I = {
  bus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6M16 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>,
  route: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  pause: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  wrench: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  seat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/></svg>,
  money: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starOutline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  fire: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  trendUp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  sprout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  power: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
};

function AdminRouteManagement() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [criteriaFilter, setCriteriaFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    totalRoutes: 0,
    activeRoutes: 0,
    inactiveRoutes: 0,
    maintenanceRoutes: 0,
  });
  const [notification, setNotification] = useState(null);

  const fetchRouteStats = useCallback(async (routeData) => {
    try {
      const response = await api.get("/admin/b2c/stats");

      if (response.data.success && response.data.stats) {
        const data = response.data.stats.routes || {};
        setStats({
          totalRoutes: data.totalRoutes || 0,
          activeRoutes: data.activeRoutes || 0,
          inactiveRoutes: data.inactiveRoutes || 0,
          maintenanceRoutes: data.maintenanceRoutes || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching route stats:", error);

      // Fallback: Calculate stats from current routes data
      const currentRoutes = routeData || routes;
      if (currentRoutes.length > 0) {
        const calculatedStats = currentRoutes.reduce(
          (acc, route) => {
            acc.totalRoutes++;
            if (route.status === "Active" || route.status === "active")
              acc.activeRoutes++;
            else if (route.status === "Inactive" || route.status === "inactive")
              acc.inactiveRoutes++;
            else if (
              route.status === "Scheduled" ||
              route.status === "maintenance"
            )
              acc.maintenanceRoutes++;
            return acc;
          },
          {
            totalRoutes: 0,
            activeRoutes: 0,
            inactiveRoutes: 0,
            maintenanceRoutes: 0,
          },
        );

        setStats(calculatedStats);
      }
    }
  }, []); // removed routes dependency to prevent loop

  const fetchRoutes = useCallback(
    async (isInitial = false) => {
      try {
        // Only show loading spinner on the very first load
        if (isInitial) {
          setLoading(true);
        }
        const response = await api.get("/admin/b2c/routes", {
          params: { status: statusFilter !== "all" ? statusFilter : undefined },
        });

        if (response.data.success) {
          const routeData = response.data.routes || [];
          setRoutes(routeData);
          await fetchRouteStats(routeData);
        }
      } catch (error) {
        console.error("Error fetching routes:", error);
        if (isInitial) {
          setRoutes([]);
        }
      } finally {
        if (isInitial) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    },
    [statusFilter, fetchRouteStats],
  );

  useEffect(() => {
    fetchRoutes(initialLoad);
  }, [fetchRoutes]);

  const handleEditClick = (route) => {
    // Admin can only view route details, not edit
    setNotification({
      type: "info",
      message: "Route details view only. B2C Partner manages their own routes.",
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSuspendRoute = async (routeId, action) => {
    try {
      setNotification({
        type: "info",
        message: `${action === "suspend" ? "Suspending" : "Activating"} route...`,
      });

      const response = await api.put(`/admin/b2c/routes/${routeId}/${action}`);

      if (response.data.success) {
        setNotification({
          type: "success",
          message: `Route ${action}d successfully!`,
        });
        await fetchRoutes();
      } else {
        throw new Error(response.data.message || `Failed to ${action} route`);
      }
    } catch (error) {
      console.error(`Error ${action}ing route:`, error);
      setNotification({
        type: "error",
        message: error.message || `Failed to ${action} route`,
      });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (window.confirm("Are you sure you want to delete this route?")) {
      try {
        setNotification({ type: "info", message: "Deleting route..." });
        const response = await api.delete(`/admin/b2c/routes/${routeId}`);

        if (response.data.success) {
          setNotification({
            type: "success",
            message: "Route deleted successfully!",
          });
          await Promise.all([fetchRoutes(), fetchRouteStats()]);
        } else {
          throw new Error(response.data.message || "Failed to delete route");
        }
      } catch (error) {
        console.error("Error deleting route:", error);
        setNotification({
          type: "error",
          message: error.message || "Failed to delete route",
        });
      } finally {
        setTimeout(() => setNotification(null), 3000);
      }
    }
  };

  const handleToggleStatus = async (routeId, currentStatus) => {
    try {
      // Normalize status comparison (handle both cases)
      const isActive = currentStatus?.toLowerCase() === "active";
      const newStatus = isActive ? "Inactive" : "Active";
      setNotification({
        type: "info",
        message: `Updating route status to ${newStatus}...`,
      });
      const response = await api.put(`/admin/b2c/routes/${routeId}`, {
        status: newStatus,
      });

      if (response.data.success) {
        setNotification({
          type: "success",
          message: `Route ${newStatus} successfully!`,
        });
        await Promise.all([fetchRoutes(), fetchRouteStats()]);
      } else {
        throw new Error(
          response.data.message || "Failed to update route status",
        );
      }
    } catch (error) {
      console.error("Error updating route status:", error);
      setNotification({
        type: "error",
        message: error.message || "Failed to update route status",
      });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleToggleFeatured = async (routeId, currentFeatured) => {
    try {
      setNotification({ type: "info", message: "Updating featured status..." });
      const response = await api.put(`/admin/b2c/routes/${routeId}`, {
        featured: !currentFeatured,
      });

      if (response.data.success) {
        setNotification({
          type: "success",
          message: `Route ${!currentFeatured ? "featured" : "unfeatured"} successfully!`,
        });
        await Promise.all([fetchRoutes(), fetchRouteStats()]);
      } else {
        throw new Error(
          response.data.message || "Failed to update featured status",
        );
      }
    } catch (error) {
      console.error("Error updating featured status:", error);
      setNotification({
        type: "error",
        message: error.message || "Failed to update featured status",
      });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.startPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.endPoint.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCriteria =
      criteriaFilter === "all" || route.bookingCriteria === criteriaFilter;

    return matchesSearch && matchesCriteria;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#28a745";
      case "inactive":
        return "#dc3545";
      case "pending":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  if (loading) {
    return (
      <div className="route-management-container">
        <div className="route-management-loading">
          <div className="route-management-spinner"></div>
          <p>Loading routes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-management-container">
      {/* Notification */}
      {notification && (
        <div
          className={`route-management-notification route-management-notification-${notification.type}`}
        >
          <span className="route-management-notification-icon">
            {notification.type === "success"
              ? I.check
              : notification.type === "error"
                ? I.alert
                : I.clock}
          </span>
          <span className="route-management-notification-message">
            {notification.message}
          </span>
        </div>
      )}

      <div className="route-management-header">
        <div className="route-management-title-section">
          <h3 className="route-management-title">
            <span className="route-management-icon">{I.bus}</span>
            B2C Route Management
          </h3>
          <p className="route-management-description">
            Manage and monitor all B2C transportation routes and schedules
          </p>
        </div>

        <div className="route-management-stats">
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon">{I.route}</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">
                {stats.totalRoutes}
              </span>
              <span className="route-management-stat-label">Total Routes</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon route-management-stat-icon-active">{I.check}</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">
                {stats.activeRoutes}
              </span>
              <span className="route-management-stat-label">Active</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon route-management-stat-icon-inactive">{I.pause}</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">
                {stats.inactiveRoutes}
              </span>
              <span className="route-management-stat-label">Inactive</span>
            </div>
          </div>
          <div className="route-management-stat-item">
            <div className="route-management-stat-icon route-management-stat-icon-maintenance">{I.wrench}</div>
            <div className="route-management-stat-content">
              <span className="route-management-stat-number">
                {stats.maintenanceRoutes}
              </span>
              <span className="route-management-stat-label">Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      <div className="route-management-controls">
        <div className="route-management-search">
          <div className="route-management-search-container">
            <span className="route-management-search-icon">{I.search}</span>
            <input
              type="text"
              placeholder="Search routes by name, provider, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="route-management-search-input"
            />
          </div>
        </div>

        <div className="route-management-filters">
          <select
            className="route-management-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <select
            className="route-management-filter-select"
            value={criteriaFilter}
            onChange={(e) => setCriteriaFilter(e.target.value)}
          >
            <option value="all">All Demand</option>
            <option value="high">High Demand</option>
            <option value="medium">Medium Demand</option>
            <option value="low">Low Demand</option>
          </select>
        </div>
      </div>

      <div className="route-management-content">
        <div className="route-management-grid">
          {filteredRoutes.map((route) => (
            <div key={route._id} className="route-management-card">
              <div className="route-management-card-header">
                <div className="route-management-title-section">
                  <h4 className="route-management-route-name">{route.name}</h4>
                  {route.featured && (
                    <span className="route-management-featured-badge">
                      <span className="route-management-badge-icon">{I.star}</span>
                      Featured
                    </span>
                  )}
                  {route.bookingCriteria && (
                    <span
                      className={`route-management-criteria-badge route-management-criteria-${route.bookingCriteria}`}
                      title={`${route.totalBookings || 0} booking(s) on this route`}
                    >
                      <span className="route-management-badge-icon">
                        {route.bookingCriteria === "high"
                          ? I.fire
                          : route.bookingCriteria === "medium"
                            ? I.trendUp
                            : I.sprout}
                      </span>
                      {route.bookingCriteria === "high"
                        ? "High demand"
                        : route.bookingCriteria === "medium"
                          ? "Medium demand"
                          : "Low demand"}
                    </span>
                  )}
                </div>
                <div className="route-management-status-badge">
                  <span
                    className={`route-management-status route-management-status-${route.status.toLowerCase()}`}
                  >
                    {route.status}
                  </span>
                </div>
              </div>

              <div className="route-management-card-content">
                <div className="route-management-provider">
                  <span className="route-management-provider-label">
                    Provider:
                  </span>
                  <span className="route-management-provider-name">
                    {route.providerName}
                  </span>
                </div>

                <div className="route-management-path">
                  <div className="route-management-point">
                    <span className="route-management-point-icon">{I.pin}</span>
                    <span className="route-management-point-text">
                      {route.startPoint}
                    </span>
                  </div>
                  <div className="route-management-arrow">{I.arrow}</div>
                  <div className="route-management-point">
                    <span className="route-management-point-icon route-management-point-icon-end">{I.target}</span>
                    <span className="route-management-point-text">
                      {route.endPoint}
                    </span>
                  </div>
                </div>

                <div className="route-management-details">
                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">{I.clock}</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">
                        Time
                      </span>
                      <span className="route-management-detail-value">
                        {route.departureTime} - {route.arrivalTime}
                      </span>
                    </div>
                  </div>

                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">{I.seat}</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">
                        Capacity
                      </span>
                      <span className="route-management-detail-value">
                        {route.bookedSeats}/{route.capacity}
                      </span>
                    </div>
                  </div>

                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">{I.money}</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">
                        Price
                      </span>
                      <span className="route-management-detail-value">
                        {route.pricing?.currency || route.currency || getActiveCurrency()}{" "}
                        {route.price?.toFixed(
                          getCurrencyDecimals(
                            route.pricing?.currency || route.currency || getActiveCurrency(),
                          ),
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="route-management-detail-item">
                    <span className="route-management-detail-icon">{I.chart}</span>
                    <div className="route-management-detail-content">
                      <span className="route-management-detail-label">
                        Bookings
                      </span>
                      <span className="route-management-detail-value">
                        {route.totalBookings || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="route-management-card-actions">
                <button
                  className="route-management-action-btn route-management-edit-btn"
                  onClick={() => handleEditClick(route)}
                >
                  <span className="route-management-btn-icon">{I.edit}</span>
                  Edit
                </button>
                <button
                  className="route-management-action-btn route-management-status-btn"
                  onClick={() => handleToggleStatus(route._id, route.status)}
                >
                  <span className="route-management-btn-icon">
                    {route.status?.toLowerCase() === "active" ? I.pause : I.power}
                  </span>
                  {route.status?.toLowerCase() === "active"
                    ? "Deactivate"
                    : "Activate"}
                </button>
                <button
                  className="route-management-action-btn route-management-featured-btn"
                  onClick={() =>
                    handleToggleFeatured(route._id, route.featured)
                  }
                >
                  <span className="route-management-btn-icon">
                    {route.featured ? I.star : I.starOutline}
                  </span>
                  {route.featured ? "Unfeature" : "Feature"}
                </button>
                <button
                  className="route-management-action-btn route-management-delete-btn"
                  onClick={() => handleDeleteRoute(route._id)}
                >
                  <span className="route-management-btn-icon">{I.trash}</span>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="route-management-empty">
          <div className="route-management-empty-icon">{I.search}</div>
          <h3>No Routes Found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

export default AdminRouteManagement;
