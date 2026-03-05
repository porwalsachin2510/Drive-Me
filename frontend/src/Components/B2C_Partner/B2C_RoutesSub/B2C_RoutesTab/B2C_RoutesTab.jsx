"use client";

import { useState } from "react";
import B2C_RouteCard from "../B2C_RouteCard/B2C_RouteCard";
import "./b2c_routestab.css";

function B2C_RoutesTab({ routes, onRefresh, onAddSchedule }) {
  const [filter, setFilter] = useState("all");

  const filteredRoutes = routes.filter(route => {
    if (filter === "all") return true;
    if (filter === "active") return route.status === "Active";
    if (filter === "inactive") return route.status === "Inactive";
    return true;
  });

  return (
    <div className="b2c-routes-tab">
      <div className="b2c-routes-filters">
        <div className="b2c-filter-buttons">
          <button
            className={`b2c-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Routes ({routes.length})
          </button>
          <button
            className={`b2c-filter-btn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active ({routes.filter(r => r.status === "Active").length})
          </button>
          <button
            className={`b2c-filter-btn ${filter === "inactive" ? "active" : ""}`}
            onClick={() => setFilter("inactive")}
          >
            Inactive ({routes.filter(r => r.status === "Inactive").length})
          </button>
        </div>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="b2c-empty-state">
          <div className="b2c-empty-icon">🗺️</div>
          <h3 className="b2c-empty-title">
            {filter === "all" ? "No Routes Added" : `No ${filter} routes`}
          </h3>
          <p className="b2c-empty-description">
            {filter === "all" 
              ? "Start by adding your first route to offer transportation services"
              : `No ${filter} routes found. Try changing the filter or add new routes.`
            }
          </p>
        </div>
      ) : (
        <div className="b2c-routes-grid">
          {filteredRoutes.map((route) => (
            <B2C_RouteCard 
              key={route._id} 
              route={route} 
              onRefresh={onRefresh}
              onAddSchedule={onAddSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default B2C_RoutesTab;
