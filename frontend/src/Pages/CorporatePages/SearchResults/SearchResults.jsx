import { getActiveCurrency } from "../../../config/localeConfig";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  MapPin,
  Star,
  Phone,
  Mail,
  Calendar,
  Users,
  CheckCircle,
} from "lucide-react";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import RoleRestrictionModal from "../../../Components/RoleRestrictionModal/RoleRestrictionModal";
import {
  selectIsAuthenticated,
  selectUserRole,
} from "../../../Redux/selectors/authSelectors";
import { storeNavigationState } from "../../../utils/loginRedirect";
import "./SearchResults.css";

const FleetSearchResults = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userRole = useSelector(selectUserRole);

  const [selectedVehicles, setSelectedVehicles] = useState({});
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [activeTab, setActiveTab] = useState("corporate");
  const [showRoleRestrictionModal, setShowRoleRestrictionModal] =
    useState(false);

  // Filters the corporate user can apply to refine the partner/vehicle list.
  const [filters, setFilters] = useState({
    priceMin: "",
    priceMax: "",
    driverOnly: false,
    fuelOnly: false,
    minRating: 0,
    categories: [],
    facilities: { AC: false, WiFi: false, GPS: false, Music: false },
    requireAllCategories: false,
  });

  useEffect(() => {
    localStorage.setItem("activeTab", "corporate");
  }, []);

  // Real search results data from backend API via location state
  const searchData = location.state?.results;
  const userfilters = location.state?.filters;

  // Vehicle types the corporate actually searched for (supports the multi-select
  // search: userfilters.vehicleTypes[] with legacy single userfilters.vehicleType).
  const searchedTypes = useMemo(() => {
    const t = userfilters?.vehicleTypes ?? userfilters?.vehicleType;
    if (!t) return [];
    return (Array.isArray(t) ? t : [t])
      .filter(Boolean)
      .map((x) => String(x).toUpperCase());
  }, [userfilters]);

  // Distinct vehicle categories present across all returned owners (for the
  // category filter checkboxes).
  const availableCategories = useMemo(() => {
    const set = new Set();
    (searchData?.fleetOwners || []).forEach((o) =>
      (o.vehicles || []).forEach(
        (v) => v.vehicleCategory && set.add(v.vehicleCategory),
      ),
    );
    return Array.from(set);
  }, [searchData]);

  // Apply active filters + sort. Filtering runs on each owner's previewed
  // vehicles; owners left with no matching vehicle are hidden. Sorting orders
  // both the vehicles inside each owner and the owners themselves.
  const processedOwners = useMemo(() => {
    const duration = userfilters?.rentalDuration || "monthly";
    const priceOf = (vehicle) => {
      const p = vehicle.pricing || {};
      switch (duration) {
        case "daily":
          return p.dailyRate || 0;
        case "weekly":
          return p.weeklyRate > 0 ? p.weeklyRate : (p.dailyRate || 0) * 7;
        case "long-term":
          return p.yearlyRate > 0 ? p.yearlyRate : (p.monthlyRate || 0) * 12;
        case "monthly":
        default:
          return p.monthlyRate || 0;
      }
    };

    const min = filters.priceMin === "" ? 0 : Number(filters.priceMin) || 0;
    const max =
      filters.priceMax === "" ? Infinity : Number(filters.priceMax) || Infinity;
    const facilityKeyMap = {
      AC: "airConditioning",
      WiFi: "wifiOnboard",
      GPS: "gpsTracking",
      Music: "musicSystem",
    };

    let owners = (searchData?.fleetOwners || []).map((owner) => {
      let vehicles = (owner.vehicles || []).filter((v) => {
        const price = priceOf(v);
        if (price < min || price > max) return false;
        if (filters.driverOnly && !v.driverAvailability?.withDriver)
          return false;
        if (filters.fuelOnly && !v.fuelOptions?.fuelIncluded) return false;
        if (
          filters.categories.length > 0 &&
          !filters.categories.includes(v.vehicleCategory)
        )
          return false;
        for (const [label, on] of Object.entries(filters.facilities)) {
          if (on && !v.facilities?.[facilityKeyMap[label]]) return false;
        }
        return true;
      });

      if (sortBy === "price-low")
        vehicles = [...vehicles].sort((a, b) => priceOf(a) - priceOf(b));
      else if (sortBy === "price-high")
        vehicles = [...vehicles].sort((a, b) => priceOf(b) - priceOf(a));

      return { ...owner, vehicles };
    });

    owners = owners.filter((o) => o.vehicles.length > 0);

    if (filters.minRating > 0)
      owners = owners.filter(
        (o) => parseFloat(o.rating || 0) >= filters.minRating,
      );

    if (filters.requireAllCategories && searchedTypes.length > 1)
      owners = owners.filter((o) => {
        const cats = new Set(
          o.vehicles.map((v) => String(v.vehicleCategory).toUpperCase()),
        );
        return searchedTypes.every((t) => cats.has(t));
      });

    const ownerMin = (o) => Math.min(...o.vehicles.map(priceOf));
    const ownerMax = (o) => Math.max(...o.vehicles.map(priceOf));
    if (sortBy === "price-low")
      owners = [...owners].sort((a, b) => ownerMin(a) - ownerMin(b));
    else if (sortBy === "price-high")
      owners = [...owners].sort((a, b) => ownerMax(b) - ownerMax(a));
    else if (sortBy === "rating")
      owners = [...owners].sort(
        (a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0),
      );

    return owners;
  }, [searchData, userfilters, sortBy, filters, searchedTypes]);

  // If no search data, redirect to corporate search page
  if (
    !searchData ||
    !searchData.fleetOwners ||
    searchData.fleetOwners.length === 0
  ) {
    return (
      <>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="drivemego-searchresults-fleet-search-container">
          <div className="drivemego-searchresults-header">
            <div className="drivemego-searchresults-header-content">
              <h1 className="drivemego-searchresults-title">
                No Search Results
              </h1>
              <p className="drivemego-searchresults-subtitle">
                Please search for vehicles first
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "40px" }}>
            <button
              className="drivemego-searchresults-primary-button"
              onClick={() => navigate("/corporate")}
              style={{ padding: "12px 24px", fontSize: "16px" }}
            >
              Go to Vehicle Search
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const toggleVehicleSelection = (fleetOwnerId, vehicleId) => {
    setSelectedVehicles((prev) => {
      const key = `${fleetOwnerId}-${vehicleId}`;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  };

  const updateFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (cat) =>
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));

  const toggleFacility = (label) =>
    setFilters((prev) => ({
      ...prev,
      facilities: { ...prev.facilities, [label]: !prev.facilities[label] },
    }));

  const resetFilters = () =>
    setFilters({
      priceMin: "",
      priceMax: "",
      driverOnly: false,
      fuelOnly: false,
      minRating: 0,
      categories: [],
      facilities: { AC: false, WiFi: false, GPS: false, Music: false },
      requireAllCategories: false,
    });

  const priceDurationLabel =
    {
      daily: "per day",
      weekly: "per week",
      "long-term": "per year",
      monthly: "per month",
    }[userfilters?.rentalDuration || "monthly"] || "per month";

  const activeFilterCount =
    (filters.priceMin !== "" || filters.priceMax !== "" ? 1 : 0) +
    (filters.driverOnly ? 1 : 0) +
    (filters.fuelOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    filters.categories.length +
    Object.values(filters.facilities).filter(Boolean).length +
    (filters.requireAllCategories ? 1 : 0);

  const formatCurrency = (amount, currency = getActiveCurrency()) => {
    return `${amount?.toLocaleString() || 0} ${currency}`;
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

  // Goods carriers report cargo capacity (tons), passenger vehicles report seats.
  const isGoodsVehicle = (vehicle) =>
    vehicle?.serviceType === "GOODS_CARRIER" ||
    (!vehicle?.capacity?.seatingCapacity && !!vehicle?.capacity?.cargoCapacity);

  // Build the price shown on a card based on the rental duration the user
  // actually searched for (daily / weekly / monthly / long-term), so a weekly
  // search never shows the monthly rate.
  const getPriceDisplay = (vehicle) => {
    const pricing = vehicle.pricing || {};
    const currency = pricing.currency || getActiveCurrency();
    const duration = userfilters?.rentalDuration || "monthly";

    switch (duration) {
      case "daily":
        return {
          main: `${formatCurrency(pricing.dailyRate, currency)}/day`,
          detail:
            pricing.weeklyRate > 0
              ? `${formatCurrency(pricing.weeklyRate, currency)}/week`
              : null,
        };
      case "weekly":
        return {
          main: `${formatCurrency(
            pricing.weeklyRate > 0 ? pricing.weeklyRate : pricing.dailyRate * 7,
            currency,
          )}/week`,
          detail: `${formatCurrency(pricing.dailyRate, currency)}/day`,
        };
      case "long-term":
        return {
          main: `${formatCurrency(
            pricing.yearlyRate > 0
              ? pricing.yearlyRate
              : pricing.monthlyRate * 12,
            currency,
          )}/year`,
          detail: `${formatCurrency(pricing.monthlyRate, currency)}/month`,
        };
      case "monthly":
      default:
        return {
          main: `${formatCurrency(pricing.monthlyRate, currency)}/month`,
          detail: `${formatCurrency(pricing.dailyRate, currency)}/day`,
        };
    }
  };

  const handleViewAll = (result, userfilters) => {
    // If not authenticated, redirect to login with return state
    if (!isAuthenticated) {
      storeNavigationState("view-vehicles", { result, userfilters });
      navigate("/login", {
        state: {
          returnTo: "/view-single-vehicle-owner",
          returnState: { userfilters, results: result },
          requiredRole: "CORPORATE",
          message: "Please login as a Corporate user to view fleet details.",
        },
      });
      return;
    }

    // Check if user is authenticated and has CORPORATE role
    if (userRole !== "CORPORATE") {
      // Show role restriction modal
      setShowRoleRestrictionModal(true);
      return;
    }

    navigate("/view-single-vehicle-owner", {
      state: { userfilters, results: result },
    });
  };

  return (
    <>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="fleet-search-container">
        {/* Header Section */}
        <div className="drivemego-searchresults-header">
          <div className="drivemego-searchresults-header-content">
            <h1 className="drivemego-searchresults-title">
              Vehicle Search Results
            </h1>
            <p className="drivemego-searchresults-subtitle">
              Showing {processedOwners.length} fleet owner
              {processedOwners.length !== 1 ? "s" : ""} of{" "}
              {searchData.totalFleetOwners} matched
              {activeFilterCount > 0 ? " · filtered" : ""}
            </p>
          </div>

          <div className="drivemego-searchresults-header-controls">
            <select
              className="drivemego-searchresults-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="relevance">Sort By: Relevance</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>

            <button
              className={`drivemego-searchresults-filter-button${
                showFilters || activeFilterCount > 0
                  ? " drivemego-searchresults-filter-active"
                  : ""
              }`}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>

            <button
              className="drivemego-searchresults-view-button"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              {viewMode === "grid" ? "List View" : "Grid View"}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="drivemego-searchresults-filter-panel">
            <div className="drivemego-searchresults-filter-grid">
              {/* Price range */}
              <div className="drivemego-searchresults-filter-group">
                <label className="drivemego-searchresults-filter-label">
                  Price ({priceDurationLabel})
                </label>
                <div className="drivemego-searchresults-filter-price-row">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    className="drivemego-searchresults-filter-input"
                    value={filters.priceMin}
                    onChange={(e) => updateFilter("priceMin", e.target.value)}
                  />
                  <span className="drivemego-searchresults-filter-dash">–</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    className="drivemego-searchresults-filter-input"
                    value={filters.priceMax}
                    onChange={(e) => updateFilter("priceMax", e.target.value)}
                  />
                </div>
              </div>

              {/* Vehicle category */}
              {availableCategories.length > 0 && (
                <div className="drivemego-searchresults-filter-group">
                  <label className="drivemego-searchresults-filter-label">
                    Vehicle Type
                  </label>
                  <div className="drivemego-searchresults-filter-chips">
                    {availableCategories.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        className={`drivemego-searchresults-filter-chip${
                          filters.categories.includes(cat)
                            ? " drivemego-searchresults-filter-chip-on"
                            : ""
                        }`}
                        onClick={() => toggleCategory(cat)}
                      >
                        {cat.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amenities */}
              <div className="drivemego-searchresults-filter-group">
                <label className="drivemego-searchresults-filter-label">
                  Amenities
                </label>
                <div className="drivemego-searchresults-filter-checks">
                  <label className="drivemego-searchresults-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.driverOnly}
                      onChange={(e) =>
                        updateFilter("driverOnly", e.target.checked)
                      }
                    />
                    <span>Driver included</span>
                  </label>
                  <label className="drivemego-searchresults-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.fuelOnly}
                      onChange={(e) =>
                        updateFilter("fuelOnly", e.target.checked)
                      }
                    />
                    <span>Fuel included</span>
                  </label>
                </div>
              </div>

              {/* Facilities */}
              <div className="drivemego-searchresults-filter-group">
                <label className="drivemego-searchresults-filter-label">
                  Facilities
                </label>
                <div className="drivemego-searchresults-filter-chips">
                  {["AC", "WiFi", "GPS", "Music"].map((label) => (
                    <button
                      type="button"
                      key={label}
                      className={`drivemego-searchresults-filter-chip${
                        filters.facilities[label]
                          ? " drivemego-searchresults-filter-chip-on"
                          : ""
                      }`}
                      onClick={() => toggleFacility(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minimum rating */}
              <div className="drivemego-searchresults-filter-group">
                <label className="drivemego-searchresults-filter-label">
                  Minimum Rating
                </label>
                <select
                  className="drivemego-searchresults-filter-select"
                  value={filters.minRating}
                  onChange={(e) =>
                    updateFilter("minRating", Number(e.target.value))
                  }
                >
                  <option value={0}>Any rating</option>
                  <option value={3}>3.0+</option>
                  <option value={4}>4.0+</option>
                  <option value={4.5}>4.5+</option>
                </select>
              </div>
            </div>

            <div className="drivemego-searchresults-filter-footer">
              {searchedTypes.length > 1 && (
                <label className="drivemego-searchresults-filter-check">
                  <input
                    type="checkbox"
                    checked={filters.requireAllCategories}
                    onChange={(e) =>
                      updateFilter("requireAllCategories", e.target.checked)
                    }
                  />
                  <span>
                    Only partners offering all my requested vehicle types
                  </span>
                </label>
              )}
              <button
                type="button"
                className="drivemego-searchresults-reset-button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Search Parameters Display */}
        <div className="drivemego-searchresults-search-params-bar">
          <div className="drivemego-searchresults-search-param">
            <MapPin size={16} />
            <span>{searchData.searchParams.location}</span>
          </div>
          <div className="drivemego-searchresults-search-param">
            <Users size={16} />
            <span>
              {searchData.searchParams.serviceType === "goods"
                ? `${searchData.searchParams.minseatsrequired}+ tons`
                : `${searchData.searchParams.minseatsrequired}+ Seats`}
            </span>
          </div>
          <div className="drivemego-searchresults-search-param">
            <Calendar size={16} />
            <span>{searchData.searchParams.rentalDuration}</span>
          </div>
          <div className="drivemego-searchresults-search-param">
            <span>Budget: {searchData.searchParams.budget}</span>
          </div>
        </div>

        {/* Fleet Owners List */}
        <div className="drivemego-searchresults-search-param-results-container">
          {processedOwners.length === 0 && (
            <div className="drivemego-searchresults-no-match">
              <h3>No vehicles match your filters</h3>
              <p>
                Try adjusting or resetting your filters to see more results.
              </p>
              <button
                className="drivemego-searchresults-reset-button"
                onClick={resetFilters}
              >
                Reset Filters
              </button>
            </div>
          )}
          {processedOwners.map((owner) => (
            <div
              key={owner.fleetOwnerId}
              className="drivemego-searchresults-search-param-fleet-owner-card"
            >
              {/* Fleet Owner Header */}
              <div className="drivemego-searchresults-owner-header">
                <div className="drivemego-searchresults-owner-info">
                  <div className="drivemego-searchresults-owner-name-row">
                    <h2 className="drivemego-searchresults-owner-name">
                      🚐 {owner.fullName}
                    </h2>
                    {parseFloat(owner.rating) > 0 && (
                      <div className="drivemego-searchresults-rating-badge">
                        <Star size={16} fill="#fbbf24" color="#fbbf24" />
                        <span>{owner.rating}</span>
                      </div>
                    )}
                  </div>

                  <div className="drivemego-searchresults-owner-meta">
                    <div className="drivemego-searchresults-meta-item">
                      <MapPin size={14} />
                      <span>
                        {owner.vehicles[0]?.location ||
                          "Location not specified"}
                      </span>
                    </div>
                    <div className="drivemego-searchresults-verified-badge">
                      <CheckCircle size={14} />
                      <span>Verified Fleet Owner</span>
                    </div>
                    <div className="drivemego-searchresults-meta-item">
                      <span>
                        {owner.totalVehicles} Vehicle
                        {owner.totalVehicles !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="drivemego-searchresults-contact-info">
                    <div className="drivemego-searchresults-contact-item">
                      <Phone size={14} />
                      <span>{owner.whatsappNumber}</span>
                    </div>
                    <div className="drivemego-searchresults-contact-item">
                      <Mail size={14} />
                      <span>{owner.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicles Grid */}
              <div className="drivemego-searchresults-vehicles-grid">
                {owner.vehicles.map((vehicle, index) => {
                  const isSelected =
                    selectedVehicles[`${owner.fleetOwnerId}-${vehicle._id}`];

                  return (
                    <div
                      key={vehicle._id}
                      className={`drivemego-searchresults-vehicle-card ${isSelected ? "drivemego-searchresults-selected" : ""}`}
                      onClick={() =>
                        toggleVehicleSelection(owner.fleetOwnerId, vehicle._id)
                      }
                    >
                      <div className="drivemego-searchresults-vehicle-image-container">
                        <img
                          src={
                            vehicle.photos[0]?.url ||
                            "https://via.placeholder.com/300x200?text=No+Image"
                          }
                          alt={vehicle.vehicleName}
                          className="drivemego-searchresults-vehicle-image"
                        />
                        {isSelected && (
                          <div className="drivemego-searchresults-selected-overlay">
                            <CheckCircle size={32} color="white" fill="white" />
                          </div>
                        )}
                      </div>

                      <div className="drivemego-searchresults-vehicle-content">
                        <h3 className="drivemego-searchresults-vehicle-name">
                          Vehicle {index + 1}
                        </h3>
                        <p className="drivemego-searchresults-vehicle-model">
                          {vehicle.vehicleName}
                        </p>

                        <div className="drivemego-searchresults-vehicle-specs">
                          <div className="drivemego-searchresults-spec-item">
                            <Users size={14} />
                            <span>
                              {isGoodsVehicle(vehicle)
                                ? vehicle.capacity?.cargoCapacity
                                  ? `${vehicle.capacity.cargoCapacity} tons`
                                  : "N/A"
                                : `${vehicle.capacity?.seatingCapacity || 0} Seater`}
                            </span>
                          </div>
                          <div className="drivemego-searchresults-spec-item">
                            <span>
                              {vehicle.vehicleCategory.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <div className="drivemego-searchresults-vehicle-price">
                          <span className="drivemego-searchresults-price-amount">
                            {getPriceDisplay(vehicle).main}
                          </span>
                          {getPriceDisplay(vehicle).detail && (
                            <span className="drivemego-searchresults-price-detail">
                              {getPriceDisplay(vehicle).detail}
                            </span>
                          )}
                        </div>

                        <div className="drivemego-searchresults-facilities-list">
                          {getFacilityIcons(vehicle.facilities)
                            .slice(0, 4)
                            .map((facility, idx) => (
                              <span
                                key={idx}
                                className="drivemego-searchresults-facility-badge"
                              >
                                ✓ {facility}
                              </span>
                            ))}
                          {getFacilityIcons(vehicle.facilities).length > 4 && (
                            <span className="drivemego-searchresults-facility-badge">
                              +{getFacilityIcons(vehicle.facilities).length - 4}
                            </span>
                          )}
                        </div>

                        <div className="drivemego-searchresults-availability-info">
                          {vehicle.driverAvailability.withDriver && (
                            <span className="drivemego-searchresults-avail-badge">
                              ✓ Driver
                            </span>
                          )}
                          {vehicle.fuelOptions.fuelIncluded && (
                            <span className="drivemego-searchresults-avail-badge">
                              ✓ Fuel
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {owner.totalVehicles > owner.vehicles.length && (
                  <div className="drivemego-searchresults-more-vehicles-card">
                    <div className="drivemego-searchresults-more-vehicles-content">
                      <span className="drivemego-searchresults-more-vehicles-count">
                        +{owner.totalVehicles - owner.vehicles.length} More
                      </span>
                      <span className="drivemego-searchresults-more-vehicles-text">
                        Vehicles Available
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="drivemego-searchresults-action-buttons">
                <button
                  className="drivemego-searchresults-primary-button"
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
          <div className="drivemego-searchresults-pagination">
            <button className="drivemego-searchresults-pagination-button">
              Previous
            </button>
            <span className="drivemego-searchresults-page-info">
              Page {searchData.currentPage} of {searchData.totalPages}
            </span>
            <button className="drivemego-searchresults-pagination-button">
              Next
            </button>
          </div>
        )}
      </div>
      <Footer />

      {/* Role Restriction Modal */}
      <RoleRestrictionModal
        isOpen={showRoleRestrictionModal}
        onClose={() => setShowRoleRestrictionModal(false)}
        title="Corporate Access Required"
        message="Only Corporate users can View All Vehicles. Please login with a Corporate account."
        requiredRole="CORPORATE"
        currentRole={userRole}
        onLogin={() => navigate("/login")}
      />
    </>
  );
};

export default FleetSearchResults;
