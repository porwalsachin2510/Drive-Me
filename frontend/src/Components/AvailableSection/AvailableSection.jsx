"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import BookingModal from "../BookingModal/BookingModal";

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
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
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

  // Calculate monthly price from one-way price if not available
  const calculateMonthlyPrice = (route) => {
    // If route already has monthlyPrice, use it
    if (route.monthlyPrice && route.monthlyPrice !== "N/A") {
      return typeof route.monthlyPrice === 'number' 
        ? route.monthlyPrice.toFixed(2) 
        : route.monthlyPrice;
    }
    
    // Calculate from one-way price
    const oneWayPrice = route.pricing?.oneWayPrice || route.oneWayPrice || route.price;
    if (!oneWayPrice) return null;
    
    // Calculate travel days per month based on available days
    const daysPerWeek = route.availableDays?.length || route.daysOfWeek?.length || 5;
    const travelDaysPerMonth = Math.round(daysPerWeek * 4.33); // ~4.33 weeks per month
    
    // Monthly price = one-way price * travel days per month
    const monthlyPrice = parseFloat(oneWayPrice) * travelDaysPerMonth;
    return monthlyPrice.toFixed(2);
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
      // Redirect unauthenticated users to login, then back to homepage
      navigate("/login", { state: { returnTo: "/", message: "Please login as a Commuter to book a route" } });
      return;
    }

    // Check if user is a COMMUTER
    if (auth.user.role !== "COMMUTER") {
      alert("Only Commuter users can book routes. Please login with a Commuter account.");
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
    <div className="available-section">
      <div className="section-header">
        <p className="all-listings-label">ALL LISTINGS</p>
      </div>

      <div className="title-section">
        <div className="title-and-count">
          <h2 className="section-title">Available B2C Routes</h2>
          <p className="routes-count">
            Showing {showNoSearchMessage ? 0 : routes.length} routes
          </p>
        </div>

        <div className="available-section-tab-buttons">
          <button
            className={`available-section-tab-btn ${currentFilterType === "all" ? "available-section-active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            All Routes
          </button>
          <button
            className={`available-section-tab-btn ${
              currentFilterType === "matched" ? "available-section-active" : ""
            }`}
            onClick={() => handleTabChange("matched")}
          >
            Matched For Me
          </button>
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Filter by:</label>
        <div className="filter-tags">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              className={`filter-tag ${
                selectedFilter === filter ? "available-section-active" : ""
              }`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {!loading && !showNoSearchMessage && routes.length > 0 && (
        <div className="routes-list">
          {routes.map((route, idx) => {
            const isAvailable = isRouteAvailableForBooking(route);
            return (
              <div
                key={route.routeId || idx}
                className="available-section-route-item"
                style={{ borderLeftColor: getBorderColor(idx) }}
              >
                <div className="route-row-1">
                  <div className="available-section-route-info">
                    <h3 className="route-title">
                      {route.company || route.operator}
                      {route.rating && <span className="star-icon">⭐</span>}
                    </h3>
                    <span className="company-badge">{route.vehicleModel}</span>
                  </div>

                  <h6>AVAILABLE SEATS: {route.availableSeats}</h6>

                  <div className="available-section-price-section">
                    <div>
                      <p className="price-label">MONTHLY</p>
                      <p className="price-value">
                        {calculateMonthlyPrice(route)
                          ? `${calculateMonthlyPrice(route)} KWD`
                          : "Contact for price"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="route-row-2">
                  <div className="my-route-details">
                    <div className="detail-group">
                      <label className="detail-label">FROM</label>
                      <p className="detail-value">
                        <span className="detail-icon">📍</span>
                        {typeof route.fromLocation === "string"
                          ? route.fromLocation
                          : route.fromLocation?.location}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label className="detail-label">TO</label>
                      <p className="detail-value">
                        <span className="detail-icon">📍</span>
                        {typeof route.toLocation === "string"
                          ? route.toLocation
                          : route.toLocation?.location}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label className="detail-label">START DATE</label>
                      <p className="detail-value">
                        <span className="detail-icon">📅</span>
                        {formatDate(route.startDate)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="available-section-join-btn"
                    disabled={!isAvailable}
                    onClick={() => handleBookRoute(route)}
                    title={
                      !isAvailable
                        ? "Route not available. Check start date and available days."
                        : "Click to book this route"
                    }
                  >
                    <span className="book-icon">
                      {isAvailable ? "📌" : "🔒"}
                    </span>
                    {isAvailable ? "Book This Route" : "Not Available"}
                  </button>
                </div>

                {/* Available Days */}
                <div className="availablesection-featured-detail-group">
                  <label className="availablesection-detail-label">
                    AVAILABLE DAYS
                  </label>
                  <div className="my-available-days">
                    {(
                      route.dayMatching?.matchedDays ||
                      route.availableDays ||
                      []
                    ).map((day) => (
                      <span
                        key={day}
                        className={`my-day-pill ${
                          ["SAT", "SUN"].includes(day) ? "weekend" : ""
                        }`}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && routes.length === 0 && !showNoSearchMessage && (
        <div className="empty-state">
          <p>No routes available at the moment</p>
        </div>
      )}

      {!loading && showNoSearchMessage && (
        <div className="empty-state">
          <p>No routes matches available for you</p>
          <p className="empty-subtitle">Search Commutes</p>
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
    </div>
  );
};

export default AvailableSection;
