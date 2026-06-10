"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import BookingModal from "../BookingModal/BookingModal";
import RoleRestrictionModal from "../RoleRestrictionModal/RoleRestrictionModal";
import { storeNavigationState } from "../../utils/loginRedirect";
import api from "../../utils/api";
import "./availablesection.css";

const AvailableSection = ({
  routes,
  loading,
  onFilterChange,
  searchParams,
  currentFilterType,
}) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRoleRestrictionModal, setShowRoleRestrictionModal] =
    useState(false);
  const auth = useSelector((state) => state.auth);
  const filterOptions = [
    "All",
    "Budget Friendly",
    "AC Vehicle",
    "WiFi Available",
    "Premium",
    "Ladies Only",
    "Express",
  ];

  // Fetch available tags for search filtering
  useEffect(() => {
    fetchSearchTags();
  }, []);

  const fetchSearchTags = async () => {
    try {
      const response = await api.get("/admin/tags/public", {
        params: { category: "all" },
      });
      // Filter to only show route, promo, and general tags for search
      const searchableTags = (response.data.tags || []).filter((tag) =>
        ["route", "promo", "general"].includes(tag.category),
      );
      setAvailableTags(searchableTags);
    } catch (error) {
      console.error("Error fetching search tags:", error);
    }
  };

  // Handle tag filter toggle
  const handleTagFilterToggle = (tagId) => {
    setSelectedTagFilters((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Clear all tag filters
  const clearTagFilters = () => {
    setSelectedTagFilters([]);
  };

  // Filter routes by selected tags (client-side filtering)
  const getFilteredRoutes = () => {
    if (selectedTagFilters.length === 0) {
      return routes;
    }
    return routes.filter((route) => {
      if (!route.tags || route.tags.length === 0) return false;
      // Check if route has any of the selected tags
      return route.tags.some((tag) => selectedTagFilters.includes(tag._id));
    });
  };

  const filteredRoutes = getFilteredRoutes();

  const hasSearchParams =
    searchParams &&
    (searchParams.pickupLocation || searchParams.dropoffLocation);
  const showNoSearchMessage =
    currentFilterType === "matched" && !hasSearchParams;

  const handleTabChange = (tab) => {
    if (tab === "matched" && !hasSearchParams) {
      if (onFilterChange) {
        onFilterChange({
          filterType: tab,
          selectedFilter: "All",
        });
      }
      return;
    }

    if (onFilterChange) {
      if (tab === "all") {
        onFilterChange({
          filterType: "all",
          selectedFilter: "All",
        });
      } else if (tab === "matched" && hasSearchParams) {
        onFilterChange({
          filterType: "matched",
          selectedFilter: "All",
          ...searchParams,
        });
      }
    }
  };

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);

    if (onFilterChange) {
      if (currentFilterType === "all") {
        onFilterChange({
          filterType: "all",
          selectedFilter: filter,
        });
      } else if (currentFilterType === "matched" && hasSearchParams) {
        onFilterChange({
          filterType: "matched",
          selectedFilter: filter,
          ...searchParams,
        });
      }
    }
  };

  const getBorderColor = (index) => {
    const colors = [
      "#FDB913",
      "#FDB913",
      "#17A2B8",
      "#17A2B8",
      "#17A2B8",
      "#FDB913",
    ];
    return colors[index % colors.length];
  };

  const formatDate = (date) => {
    if (!date) return "TBD";
    const d = new Date(date);
    return d.toLocaleDateString("en-GB");
  };

  // Helper function to parse time string to minutes for sorting
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === "N/A") return Infinity;

    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return Infinity;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  };

  // Sort stops by time
  const sortStopsByTime = (stops) => {
    if (!stops || !Array.isArray(stops) || stops.length === 0) return [];

    return [...stops].sort((a, b) => {
      const timeA = parseTimeToMinutes(typeof a === "string" ? null : a.time);
      const timeB = parseTimeToMinutes(typeof b === "string" ? null : b.time);
      return timeA - timeB;
    });
  };

  // Calculate monthly price from one-way price if not available
  // const calculateMonthlyPrice = (route) => {
  //   // If route already has monthlyPrice, use it
  //   if (route.monthlyPrice && route.monthlyPrice !== "N/A") {
  //     return typeof route.monthlyPrice === "number"
  //       ? route.monthlyPrice.toFixed(2)
  //       : route.monthlyPrice;
  //   }

  //   // Calculate from one-way price
  //   const oneWayPrice =
  //     route.pricing?.oneWayPrice || route.oneWayPrice || route.price;
  //   if (!oneWayPrice) return null;

  //   // Calculate travel days per month based on available days
  //   const daysPerWeek =
  //     route.availableDays?.length || route.daysOfWeek?.length || 5;
  //   const travelDaysPerMonth = Math.round(daysPerWeek * 4.33); // ~4.33 weeks per month

  //   // Monthly price = one-way price * travel days per month
  //   const monthlyPrice = parseFloat(oneWayPrice) * travelDaysPerMonth;
  //   return monthlyPrice.toFixed(2);
  // };

  // Calculate monthly price from one-way price if not available
  const calculateMonthlyPrice = (route) => {
    // If route already has monthlyPrice, use it
    if (route.monthlyPrice && route.monthlyPrice !== "N/A") {
      return typeof route.monthlyPrice === "number"
        ? `${route.monthlyPrice.toFixed(2)} ${route.pricing?.currency || "KWD"}`
        : route.monthlyPrice;
    }

    // Calculate from one-way price
    const oneWayPrice =
      route.pricing?.oneWayPrice || route.oneWayPrice || route.price;
    if (!oneWayPrice) return "Contact for price";

    // Calculate travel days per month based on available days
    const daysPerWeek =
      route.availableDays?.length || route.daysOfWeek?.length || 5;
    const travelDaysPerMonth = Math.round(daysPerWeek * 4.33); // ~4.33 weeks per month

    // Monthly price = one-way price * travel days per month
    const monthlyPrice = parseFloat(oneWayPrice) * travelDaysPerMonth;
    const currency = route.pricing?.currency || "KWD";
    return `${monthlyPrice.toFixed(2)} ${currency}`;
  };

  const isRouteAvailableForBooking = (route) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(route.startDate);
    startDate.setHours(0, 0, 0, 0);

    const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const todayDay = daysOfWeek[today.getDay()];

    // Check if route has started
    if (today < startDate) {
      return false;
    }

    // Check if today is an available day
    if (route.availableDays && !route.availableDays.includes(todayDay)) {
      return false;
    }

    return true;
  };

  const handleBookRoute = (route) => {
    if (!auth.user) {
      // Store route data for return
      storeNavigationState("book-route", { route });
      // Redirect unauthenticated users to login with return to homepage
      navigate("/login", {
        state: {
          returnTo: "/",
          returnState: { openBookingRoute: route._id },
          requiredRole: "COMMUTER",
          message: "Please login as a Commuter to book a route",
        },
      });
      return;
    }

    // Check if user is a COMMUTER
    if (auth.user.role !== "COMMUTER") {
      // Show role restriction modal instead of alert
      setShowRoleRestrictionModal(true);
      return;
    }

    setSelectedRoute(route);
    setShowBookingModal(true);
  };

  const handleCloseBookingModal = () => {
    setShowBookingModal(false);
    setSelectedRoute(null);
  };

  const handleBookingSuccess = () => {
    alert("Booking successful!");
    handleCloseBookingModal();
  };

  const isCorporate = auth.user?.role === "COMMUTER" && auth.user?.companyId;

  return (
    <div className="drivemego-availablesection-available-section">
      <div className="drivemego-availablesection-section-header">
        <p className="drivemego-availablesection-all-listings-label">
          ALL LISTINGS
        </p>
      </div>

      <div className="drivemego-availablesection-title-section">
        <div className="drivemego-availablesection-title-and-count">
          <h2 className="drivemego-availablesection-section-title">
            Available B2C Routes
          </h2>
          <p className="drivemego-availablesection-routes-count">
            Showing {showNoSearchMessage ? 0 : filteredRoutes.length} routes
            {selectedTagFilters.length > 0 &&
              ` (filtered by ${selectedTagFilters.length} tag${selectedTagFilters.length > 1 ? "s" : ""})`}
          </p>
        </div>

        <div className="drivemego-availablesection-available-section-tab-buttons">
          <button
            className={`drivemego-availablesection-available-section-tab-btn ${currentFilterType === "all" ? "drivemego-availablesection-available-section-active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            All Routes
          </button>
          <button
            className={`drivemego-availablesection-available-section-tab-btn ${
              currentFilterType === "matched"
                ? "drivemego-availablesection-available-section-active"
                : ""
            }`}
            onClick={() => handleTabChange("matched")}
          >
            Matched For Me
          </button>
        </div>
      </div>

      <div className="drivemego-availablesection-filter-section">
        <label className="drivemego-availablesection-filter-label">
          Filter by:
        </label>
        <div className="drivemego-availablesection-filter-tags">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              className={`drivemego-availablesection-filter-tag ${
                selectedFilter === filter
                  ? "drivemego-availablesection-available-section-active"
                  : ""
              }`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Tag-based Filters */}
      {availableTags.length > 0 && (
        <div className="drivemego-availablesection-tag-filter-section">
          <div className="drivemego-availablesection-tag-filter-header">
            <label className="drivemego-availablesection-filter-label">
              Filter by Tags:
            </label>
            {selectedTagFilters.length > 0 && (
              <button
                className="drivemego-availablesection-clear-tags-btn"
                onClick={clearTagFilters}
              >
                Clear ({selectedTagFilters.length})
              </button>
            )}
          </div>
          <div className="drivemego-availablesection-tag-filters">
            {availableTags.map((tag) => (
              <button
                key={tag._id}
                className={`drivemego-availablesection-tag-filter-btn ${
                  selectedTagFilters.includes(tag._id) ? "selected" : ""
                }`}
                onClick={() => handleTagFilterToggle(tag._id)}
                style={{
                  backgroundColor: selectedTagFilters.includes(tag._id)
                    ? tag.color
                    : "transparent",
                  color: selectedTagFilters.includes(tag._id)
                    ? tag.textColor
                    : tag.color,
                  borderColor: tag.color,
                }}
              >
                {tag.icon && (
                  <span className="tag-filter-icon">{tag.icon}</span>
                )}
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !showNoSearchMessage && filteredRoutes.length > 0 && (
        <div className="drivemego-availablesection-routes-list">
          {filteredRoutes.map((route, idx) => {
            const isAvailable = isRouteAvailableForBooking(route);
            return (
              <div
                key={route.routeId || idx}
                className="drivemego-availablesection-available-section-route-item"
                style={{ borderLeftColor: getBorderColor(idx) }}
              >
                <div className="drivemego-availablesection-route-row-1">
                  <div className="drivemego-availablesection-available-section-route-info">
                    <h3 className="drivemego-availablesection-route-title">
                      <img
                        src={
                          route.profileImage ||
                          route.companyLogo ||
                          "/default-avatar.png"
                        }
                        alt={route.company || route.operator || "Provider"}
                        className="drivemego-availablesection-provider-avatar"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/default-avatar.png";
                        }}
                      />
                      {route.company || route.operator}
                      {route.rating && (
                        <span className="drivemego-availablesection-star-icon">
                          ⭐
                        </span>
                      )}
                    </h3>
                    <span className="drivemego-availablesection-company-badge">
                      {route.vehicleModel}
                    </span>
                    {/* Route Tags */}
                    {route.tags && route.tags.length > 0 && (
                      <div className="drivemego-availablesection-route-tags">
                        {route.tags.map((tag) => (
                          <span
                            key={tag._id}
                            className="drivemego-availablesection-route-tag"
                            style={{
                              backgroundColor: tag.color || "#6b7280",
                              color: tag.textColor || "#ffffff",
                            }}
                          >
                            {tag.icon && (
                              <span className="tag-icon">{tag.icon}</span>
                            )}
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <h6 className="drivemego-availablesection-availableseats">
                    AVAILABLE SEATS: up to {route.availableSeats}
                  </h6>

                  <div className="drivemego-availablesection-available-section-price-section">
                    <div>
                      <p className="drivemego-availablesection-price-label">
                        MONTHLY
                      </p>
                      <p className="drivemego-availablesection-price-value">
                        {calculateMonthlyPrice(route) || "Contact for price"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="drivemego-availablesection-route-row-2">
                  <div className="drivemego-availablesection-my-route-details">
                    <div className="drivemego-availablesection-detail-group">
                      <label className="drivemego-availablesection-detail-label">
                        FROM
                      </label>
                      <p className="drivemego-availablesection-detail-value">
                        <span className="drivemego-availablesection-detail-icon">
                          📍
                        </span>
                        {typeof route.fromLocation === "string"
                          ? route.fromLocation
                          : route.fromLocation?.location}
                      </p>
                    </div>

                    <div className="drivemego-availablesection-detail-group">
                      <label className="drivemego-availablesection-detail-label">
                        TO
                      </label>
                      <p className="drivemego-availablesection-detail-value">
                        <span className="drivemego-availablesection-detail-icon">
                          📍
                        </span>
                        {typeof route.toLocation === "string"
                          ? route.toLocation
                          : route.toLocation?.location}
                      </p>
                    </div>

                    <div className="drivemego-availablesection-detail-group">
                      <label className="drivemego-availablesection-detail-label">
                        START DATE
                      </label>
                      <p className="drivemego-availablesection-detail-value">
                        <span className="drivemego-availablesection-detail-icon">
                          📅
                        </span>
                        {formatDate(route.startDate)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="drivemego-availablesection-available-section-join-btn"
                    disabled={!isAvailable}
                    onClick={() => handleBookRoute(route)}
                    title={
                      !isAvailable
                        ? "Route not available. Check start date and available days."
                        : "Click to book this route"
                    }
                  >
                    <span className="drivemego-availablesection-book-icon">
                      {isAvailable ? "📌" : "🔒"}
                    </span>
                    {isAvailable ? "Book This Route" : "Not Available"}
                  </button>
                </div>

                {/* Available Days */}
                <div className="drivemego-availablesection-availablesection-featured-detail-group">
                  <label className="drivemego-availablesection-availablesection-detail-label">
                    AVAILABLE DAYS
                  </label>
                  <div className="drivemego-availablesection-my-available-days">
                    {(
                      route.availableDays ||
                      route.dayMatching?.matchedDays ||
                      []
                    ).map((day) => (
                      <span
                        key={day}
                        className={`drivemego-availablesection-my-day-pill ${
                          ["SAT", "SUN"].includes(day)
                            ? "drivemego-availablesection-weekend"
                            : ""
                        }`}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Trip Times Section - Show departure times for this route */}
                <div className="drivemego-availablesection-trip-times-section">
                  <label className="drivemego-availablesection-availablesection-detail-label">
                    TRIP TIMES
                  </label>
                  <div className="drivemego-availablesection-trip-times-container">
                    {route.tripTimes && route.tripTimes.length > 0 ? (
                      route.tripTimes.slice(0, 5).map((trip, tripIdx) => (
                        <span
                          key={tripIdx}
                          className="drivemego-availablesection-trip-time-badge"
                        >
                          {trip.departureTime || trip.time || "N/A"}
                        </span>
                      ))
                    ) : route.upcomingTrips &&
                      route.upcomingTrips.length > 0 ? (
                      route.upcomingTrips.slice(0, 5).map((trip, tripIdx) => (
                        <span
                          key={tripIdx}
                          className="drivemego-availablesection-trip-time-badge"
                        >
                          {trip.departureTime || trip.time || "N/A"}
                        </span>
                      ))
                    ) : route.pickupArrivalTime &&
                      route.pickupArrivalTime !== "N/A" ? (
                      <span className="drivemego-availablesection-trip-time-badge">
                        {route.pickupArrivalTime}
                      </span>
                    ) : (
                      <span className="drivemego-availablesection-no-trip-times">
                        Click "Book This Route" to see available times
                      </span>
                    )}
                    {route.tripTimes && route.tripTimes.length > 5 && (
                      <span className="drivemego-availablesection-more-times">
                        +{route.tripTimes.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Stop Points - Show all stops along the route */}
                {(route.allStops?.length > 0 ||
                  route.scheduleStops?.length > 0 ||
                  route.stopPoints?.length > 0) && (
                  <div className="availablesection-stops-group">
                    <label className="availablesection-detail-label">
                      <span className="stops-icon">🚏</span> ROUTE STOPS
                    </label>
                    <div className="route-stops-container">
                      {/* Start Point */}
                      <div className="route-stop-item start-point">
                        <span className="stop-dot start"></span>
                        <span className="stop-name">{route.fromLocation}</span>
                        {route.pickupArrivalTime &&
                          route.pickupArrivalTime !== "N/A" && (
                            <span className="stop-time">
                              {route.pickupArrivalTime}
                            </span>
                          )}
                      </div>

                      {/* Intermediate Stops - sorted by time and filtered to exclude from/to locations */}
                      {sortStopsByTime(
                        route.allStops ||
                          route.scheduleStops ||
                          route.stopPoints ||
                          [],
                      )
                        .filter((stop) => {
                          const stopLocation = (
                            typeof stop === "string"
                              ? stop
                              : stop.location || ""
                          )
                            .toLowerCase()
                            .trim();
                          const fromLoc = (route.fromLocation || "")
                            .toLowerCase()
                            .trim();
                          const toLoc = (route.toLocation || "")
                            .toLowerCase()
                            .trim();
                          // Exclude stops that match fromLocation or toLocation
                          return (
                            stopLocation !== fromLoc && stopLocation !== toLoc
                          );
                        })
                        .map((stop, stopIdx) => (
                          <div key={stopIdx} className="route-stop-item">
                            <span className="stop-dot"></span>
                            <span className="stop-name">
                              {typeof stop === "string" ? stop : stop.location}
                            </span>
                            {stop.time && stop.time !== "N/A" && (
                              <span className="stop-time">{stop.time}</span>
                            )}
                          </div>
                        ))}

                      {/* End Point */}
                      <div className="route-stop-item end-point">
                        <span className="stop-dot end"></span>
                        <span className="stop-name">{route.toLocation}</span>
                        {route.dropoffArrivalTime &&
                          route.dropoffArrivalTime !== "N/A" && (
                            <span className="stop-time">
                              {route.dropoffArrivalTime}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredRoutes.length === 0 && !showNoSearchMessage && (
        <div className="drivemego-availablesection-empty-state">
          <p>
            {selectedTagFilters.length > 0
              ? "No routes match the selected tags"
              : "No routes available at the moment"}
          </p>
          {selectedTagFilters.length > 0 && (
            <button
              className="drivemego-availablesection-clear-filters-btn"
              onClick={clearTagFilters}
            >
              Clear tag filters
            </button>
          )}
        </div>
      )}

      {!loading && showNoSearchMessage && (
        <div className="drivemego-availablesection-empty-state">
          <p>No routes matches available for you</p>
          <p className="drivemego-availablesection-empty-subtitle">
            Search Commutes
          </p>
        </div>
      )}

      {selectedRoute && (
        <BookingModal
          route={selectedRoute}
          isOpen={showBookingModal}
          onClose={handleCloseBookingModal}
          userRole={auth.user?.role}
          isCorporate={isCorporate}
          onSuccess={handleBookingSuccess}
        />
      )}

      {/* Role Restriction Modal */}
      <RoleRestrictionModal
        isOpen={showRoleRestrictionModal}
        onClose={() => setShowRoleRestrictionModal(false)}
        title="Commuter Access Required"
        message="Only Commuter users can book routes. Please login with a Commuter account."
        requiredRole="COMMUTER"
        currentRole={auth.user?.role}
        onLogin={() => navigate("/login")}
      />
    </div>
  );
};

export default AvailableSection;
