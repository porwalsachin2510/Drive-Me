import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  Star,
  Phone,
  Mail,
  Calendar,
  Users,
  CheckCircle,
} from "lucide-react";
import "./SearchResults.css";

const FleetSearchResults = () => {

  const location = useLocation();

  
  const [selectedVehicles, setSelectedVehicles] = useState({});
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  // Mock data based on the provided backend response
  const searchData = location.state.results;

  const userfilters = location.state.filters;

  console.log("first filters ", location.state.filters);

  const toggleVehicleSelection = (fleetOwnerId, vehicleId) => {
    setSelectedVehicles((prev) => {
      const key = `${fleetOwnerId}-${vehicleId}`;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString()}`;
  };

  const getFacilityIcons = (facilities) => {
    const icons = [];
    if (facilities.airConditioning) icons.push("AC");
    if (facilities.wifiOnboard) icons.push("WiFi");
    if (facilities.gpsTracking) icons.push("GPS");
    if (facilities.musicSystem) icons.push("Music");
    if (facilities.entertainmentScreen) icons.push("Screen");
    return icons;
  };

  const navigate = useNavigate();

  const handleViewAll = (result, userfilters) => {
    navigate("/view-single-vehicle-owner", {
      state: { userfilters, results: result },
    });
  };

  return (
    <div className="fleet-search-container">
      {/* Header Section */}
      <div className="header">
        <div className="header-content">
          <h1 className="title">Vehicle Search Results</h1>
          <p className="subtitle">
            Showing {searchData.totalVehicles} vehicles from{" "}
            {searchData.totalFleetOwners} fleet owner
            {searchData.totalFleetOwners !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="header-controls">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="relevance">Sort By: Relevance</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Rating</option>
          </select>

          <button
            className="filter-button"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
          </button>

          <button
            className="view-button"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? "List View" : "Grid View"}
          </button>
        </div>
      </div>

      {/* Search Parameters Display */}
      <div className="search-params-bar">
        <div className="search-param">
          <MapPin size={16} />
          <span>{searchData.searchParams.location}</span>
        </div>
        <div className="search-param">
          <Users size={16} />
          <span>{searchData.searchParams.minseatsrequired}+ Seats</span>
        </div>
        <div className="search-param">
          <Calendar size={16} />
          <span>{searchData.searchParams.rentalDuration}</span>
        </div>
        <div className="search-param">
          <span>Budget: {searchData.searchParams.budget}</span>
        </div>
      </div>

      {/* Fleet Owners List */}
      <div className="search-param-results-container">
        {searchData.fleetOwners.map((owner) => (
          <div
            key={owner.fleetOwnerId}
            className="search-param-fleet-owner-card"
          >
            {/* Fleet Owner Header */}
            <div className="owner-header">
              <div className="owner-info">
                <div className="owner-name-row">
                  <h2 className="owner-name">🚐 {owner.fullName}</h2>
                  {parseFloat(owner.rating) > 0 && (
                    <div className="rating-badge">
                      <Star size={16} fill="#fbbf24" color="#fbbf24" />
                      <span>{owner.rating}</span>
                    </div>
                  )}
                </div>

                <div className="owner-meta">
                  <div className="meta-item">
                    <MapPin size={14} />
                    <span>
                      {owner.vehicles[0]?.location || "Location not specified"}
                    </span>
                  </div>
                  <div className="verified-badge">
                    <CheckCircle size={14} />
                    <span>Verified Fleet Owner</span>
                  </div>
                  <div className="meta-item">
                    <span>
                      {owner.totalVehicles} Vehicle
                      {owner.totalVehicles !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="contact-info">
                  <div className="contact-item">
                    <Phone size={14} />
                    <span>{owner.whatsappNumber}</span>
                  </div>
                  <div className="contact-item">
                    <Mail size={14} />
                    <span>{owner.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicles Grid */}
            <div className="vehicles-grid">
              {owner.vehicles.map((vehicle, index) => {
                const isSelected =
                  selectedVehicles[`${owner.fleetOwnerId}-${vehicle._id}`];

                return (
                  <div
                    key={vehicle._id}
                    className={`vehicle-card ${isSelected ? "selected" : ""}`}
                    onClick={() =>
                      toggleVehicleSelection(owner.fleetOwnerId, vehicle._id)
                    }
                  >
                    <div className="vehicle-image-container">
                      <img
                        src={
                          vehicle.photos[0]?.url ||
                          "https://via.placeholder.com/300x200?text=No+Image"
                        }
                        alt={vehicle.vehicleName}
                        className="vehicle-image"
                      />
                      {isSelected && (
                        <div className="selected-overlay">
                          <CheckCircle size={32} color="white" fill="white" />
                        </div>
                      )}
                    </div>

                    <div className="vehicle-content">
                      <h3 className="vehicle-name">Vehicle {index + 1}</h3>
                      <p className="vehicle-model">{vehicle.vehicleName}</p>

                      <div className="vehicle-specs">
                        <div className="spec-item">
                          <Users size={14} />
                          <span>{vehicle.capacity.seatingCapacity} Seater</span>
                        </div>
                        <div className="spec-item">
                          <span>
                            {vehicle.vehicleCategory.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div className="vehicle-price">
                        <span className="price-amount">
                          {formatCurrency(vehicle.pricing.monthlyRate)}/month
                        </span>
                        <span className="price-detail">
                          {formatCurrency(vehicle.pricing.dailyRate)}/day
                        </span>
                      </div>

                      <div className="facilities-list">
                        {getFacilityIcons(vehicle.facilities)
                          .slice(0, 4)
                          .map((facility, idx) => (
                            <span key={idx} className="facility-badge">
                              ✓ {facility}
                            </span>
                          ))}
                        {getFacilityIcons(vehicle.facilities).length > 4 && (
                          <span className="facility-badge">
                            +{getFacilityIcons(vehicle.facilities).length - 4}
                          </span>
                        )}
                      </div>

                      <div className="availability-info">
                        {vehicle.driverAvailability.withDriver && (
                          <span className="avail-badge">✓ Driver</span>
                        )}
                        {vehicle.fuelOptions.fuelIncluded && (
                          <span className="avail-badge">✓ Fuel</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {owner.totalVehicles > owner.vehicles.length && (
                <div className="more-vehicles-card">
                  <div className="more-vehicles-content">
                    <span className="more-vehicles-count">
                      +{owner.totalVehicles - owner.vehicles.length} More
                    </span>
                    <span className="more-vehicles-text">
                      Vehicles Available
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="primary-button"
                onClick={() => handleViewAll(owner, userfilters)}
              >
                View All {owner.totalVehicles} Vehicles
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {searchData.totalPages > 1 && (
        <div className="pagination">
          <button className="pagination-button">Previous</button>
          <span className="page-info">
            Page {searchData.currentPage} of {searchData.totalPages}
          </span>
          <button className="pagination-button">Next</button>
        </div>
      )}
    </div>
  );
};

export default FleetSearchResults;
