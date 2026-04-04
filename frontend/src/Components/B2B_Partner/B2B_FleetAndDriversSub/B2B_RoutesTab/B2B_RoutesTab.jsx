"use client";

import { useState } from "react";
import B2B_RouteCard from "./B2B_RouteCard";
import "./b2b_routestab.css";

function B2B_RoutesTab({ routes, onRefresh, onAddRoute }) {
  const [filter, setFilter] = useState("all");

  const filteredRoutes = routes.filter((route) => {
    if (filter === "all") return true;
    if (filter === "active")
      return route.status === "ACTIVE" || route.status === "Active";
    if (filter === "inactive")
      return route.status === "INACTIVE" || route.status === "Inactive";
    return true;
  });

  return (
    <div className="b2b-routes-tab">
      <div className="b2b-routes-filters">
        <div className="b2b-filter-buttons">
          <button
            className={`b2b-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Routes ({routes.length})
          </button>
          <button
            className={`b2b-filter-btn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active (
            {
              routes.filter(
                (r) => r.status === "ACTIVE" || r.status === "Active",
              ).length
            }
            )
          </button>
          <button
            className={`b2b-filter-btn ${filter === "inactive" ? "active" : ""}`}
            onClick={() => setFilter("inactive")}
          >
            Inactive (
            {
              routes.filter(
                (r) => r.status === "INACTIVE" || r.status === "Inactive",
              ).length
            }
            )
          </button>
        </div>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="b2b-empty-state">
          <div className="b2b-empty-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
            >
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="b2b-empty-title">
            {filter === "all" ? "No Routes Created" : `No ${filter} routes`}
          </h3>
          <p className="b2b-empty-description">
            {filter === "all"
              ? "Create routes for your contracted vehicles to manage corporate transportation"
              : `No ${filter} routes found. Try changing the filter or add new routes.`}
          </p>
          {filter === "all" && (
            <button className="b2b-add-route-btn" onClick={onAddRoute}>
              + Add New Route
            </button>
          )}
        </div>
      ) : (
        <div className="b2b-routes-grid">
          {filteredRoutes.map((route) => (
            <B2B_RouteCard
              key={route._id}
              route={route}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default B2B_RoutesTab;
