"use client";

import { useState } from "react";
import "./FilterSidebar.css";

const FilterSidebar = ({ filters, onFilterChange, onClearFilters }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleFilterChange = (filterType, value) => {
    onFilterChange(filterType, value);
  };

  const vehicleTypes = [
    "Sedan",
    "SUV",
    "Van",
    "Luxury",
    "Bus",
    "Truck",
    "Pickup",
  ];
  const fuelTypes = ["Petrol", "Diesel", "Electric", "Hybrid"];
  const rentalDurations = ["daily", "weekly", "monthly", "longTerm"];
  const usageLevels = ["low", "medium", "high", "veryHigh"];

  return (
    <div className={`filter-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="filter-header">
        <h3>Filters</h3>
        <div className="filter-actions">
          <button className="clear-filters-btn" onClick={onClearFilters}>
            Clear All
          </button>
          <button
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <i
              className={`fas fa-chevron-${isCollapsed ? "right" : "left"}`}
            ></i>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="filter-content">
          {/* Service Type Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Service Type</h4>
            <div className="filter-options">
              <label className="filter-option">
                <input
                  type="radio"
                  name="serviceType"
                  value="passenger"
                  checked={filters.serviceType === "passenger"}
                  onChange={(e) =>
                    handleFilterChange("serviceType", e.target.value)
                  }
                />
                <span>Passenger Transport</span>
              </label>
              <label className="filter-option">
                <input
                  type="radio"
                  name="serviceType"
                  value="goods"
                  checked={filters.serviceType === "goods"}
                  onChange={(e) =>
                    handleFilterChange("serviceType", e.target.value)
                  }
                />
                <span>Goods Carrier</span>
              </label>
              <label className="filter-option">
                <input
                  type="radio"
                  name="serviceType"
                  value="managed"
                  checked={filters.serviceType === "managed"}
                  onChange={(e) =>
                    handleFilterChange("serviceType", e.target.value)
                  }
                />
                <span>Managed Services</span>
              </label>
            </div>
          </div>

          {/* Rental Duration Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Rental Duration</h4>
            <div className="filter-options">
              {rentalDurations.map((duration) => (
                <label key={duration} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.rentalDuration?.includes(duration)}
                    onChange={(e) => {
                      const currentDurations = filters.rentalDuration || [];
                      const newDurations = e.target.checked
                        ? [...currentDurations, duration]
                        : currentDurations.filter((d) => d !== duration);
                      handleFilterChange("rentalDuration", newDurations);
                    }}
                  />
                  <span>
                    {duration === "daily" && "Daily"}
                    {duration === "weekly" && "Weekly"}
                    {duration === "monthly" && "Monthly"}
                    {duration === "longTerm" && "Long-term (3+ months)"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Vehicle Type Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Vehicle Type</h4>
            <div className="filter-options">
              {vehicleTypes.map((type) => (
                <label key={type} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.vehicleTypes?.includes(type)}
                    onChange={(e) => {
                      const currentTypes = filters.vehicleTypes || [];
                      const newTypes = e.target.checked
                        ? [...currentTypes, type]
                        : currentTypes.filter((t) => t !== type);
                      handleFilterChange("vehicleTypes", newTypes);
                    }}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Seating Capacity Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Seating Capacity</h4>
            <div className="range-filter">
              <input
                type="number"
                placeholder="Min"
                value={filters.minSeats || ""}
                onChange={(e) => handleFilterChange("minSeats", e.target.value)}
                className="range-input"
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxSeats || ""}
                onChange={(e) => handleFilterChange("maxSeats", e.target.value)}
                className="range-input"
              />
            </div>
          </div>

          {/* Budget Range Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Budget Range (KD)</h4>
            <div className="range-filter">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice || ""}
                onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                className="range-input"
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice || ""}
                onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                className="range-input"
              />
            </div>
          </div>

          {/* Fuel Type Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Fuel Type</h4>
            <div className="filter-options">
              {fuelTypes.map((fuel) => (
                <label key={fuel} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.fuelTypes?.includes(fuel)}
                    onChange={(e) => {
                      const currentFuels = filters.fuelTypes || [];
                      const newFuels = e.target.checked
                        ? [...currentFuels, fuel]
                        : currentFuels.filter((f) => f !== fuel);
                      handleFilterChange("fuelTypes", newFuels);
                    }}
                  />
                  <span>{fuel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Usage Level Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Per KM Usage</h4>
            <div className="filter-options">
              {usageLevels.map((level) => (
                <label key={level} className="filter-option">
                  <input
                    type="radio"
                    name="usageLevel"
                    value={level}
                    checked={filters.usageLevel === level}
                    onChange={(e) =>
                      handleFilterChange("usageLevel", e.target.value)
                    }
                  />
                  <span>
                    {level === "low" && "Low (0-50 km/day)"}
                    {level === "medium" && "Medium (50-100 km/day)"}
                    {level === "high" && "High (100-200 km/day)"}
                    {level === "veryHigh" && "Very High (200+ km/day)"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Driver Included Filter */}
          <div className="filter-section">
            <h4 className="filter-title">Additional Options</h4>
            <div className="filter-options">
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filters.driverIncluded || false}
                  onChange={(e) =>
                    handleFilterChange("driverIncluded", e.target.checked)
                  }
                />
                <span>Driver Included</span>
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filters.fuelIncluded || false}
                  onChange={(e) =>
                    handleFilterChange("fuelIncluded", e.target.checked)
                  }
                />
                <span>Fuel Included</span>
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filters.gpsEnabled || false}
                  onChange={(e) =>
                    handleFilterChange("gpsEnabled", e.target.checked)
                  }
                />
                <span>GPS Enabled</span>
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filters.availableOnly || false}
                  onChange={(e) =>
                    handleFilterChange("availableOnly", e.target.checked)
                  }
                />
                <span>Available Only</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSidebar;
