import { useState } from "react";
import { useSelector } from "react-redux";
import BookingModal from "../BookingModal/BookingModal";
import { normalizeTime } from "../../utils/helperutility";
import "./featuredroutes.css";

const FeaturedRoutes = ({ routes, loading }) => {
  const [filters, setFilters] = useState({
    location: "",
    rating: "Any Rating",
  });


  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const auth = useSelector((state) => state.auth);

  const isCorporate = auth.user?.role === "COMMUTER" && auth.user?.companyId;

  // ===== START: FILTER ROUTES BASED ON USER FILTERS =====
  const filteredRoutes = routes.filter((route) => {
    // LOCATION FILTER
    if (filters.location) {
      const locationLower = filters.location.toLowerCase();
      const matchesLocation =
        route.fromLocation?.toLowerCase().includes(locationLower) ||
        route.toLocation?.toLowerCase().includes(locationLower) ||
        (route.stops &&
          route.stops.some((stop) =>
            stop.toLowerCase().includes(locationLower)
          ));

      if (!matchesLocation) return false;
    }

    // RATING FILTER
    if (filters.rating !== "Any Rating") {
      const minRating = Number.parseFloat(filters.rating.replace("+", ""));
      const routeRating = Number.parseFloat(route.rating || "0");
      if (routeRating < minRating) return false;
    }

    return true;
  });
  // ===== END: FILTER ROUTES BASED ON USER FILTERS =====

  const handleLocationChange = (e) => {
    setFilters({ ...filters, location: e.target.value });
  };

  const handleRatingChange = (e) => {
    setFilters({ ...filters, rating: e.target.value });
  };

  const handleReset = () => {
    setFilters({ location: "", rating: "Any Rating" });
  };

  // START: FORMAT DATE
  // const formatDate = (date) => {
  //   if (!date) return "TBD";
  //   const d = new Date(date);
  //   return d.toLocaleDateString("en-GB");
  // };
  // END: FORMAT DATE

  // START: CALCULATE DAYS OF WEEK FREQUENCY
  const getDaysFrequency = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return "5 Days/Week";
    return `${daysArray.length} Days/Week`;
  };
  // END: CALCULATE DAYS OF WEEK FREQUENCY

  
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
      alert("Please login to book a route");
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

  return (
    <div className="featured-section">
      {/* Header */}

      <div className="featured-header">
        <div className="header-content">
          <h2 className="featured-title">
            <span className="star-icon">★</span> Featured Routes & Trips
          </h2>
          <p className="featured-subtitle">
            Curated high-quality commutes with verified providers
          </p>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-text">
            <label className="filter-label mar">Location</label>

            <label className="filter-label">Min Rating</label>
          </div>

          <div className="filter-btn">
            <div className="filter-group">
              <div className="filter-input-wrapper">
                <input
                  type="text"
                  placeholder="Filter by area..."
                  value={filters.location}
                  onChange={handleLocationChange}
                  className="filter-input"
                />
              </div>
            </div>

            <div className="filter-group">
              <select
                value={filters.rating}
                onChange={handleRatingChange}
                className="filter-select"
              >
                <option>Any Rating</option>
                <option>4.0+</option>
                <option>4.5+</option>
                <option>4.8+</option>
              </select>
            </div>

            <button className="reset-button" onClick={handleReset}>
              <span className="filter-icon">⚙</span> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      {!loading && filteredRoutes.length > 0 && (
        <div className="routes-grid">
          {filteredRoutes.map((route) => {
            const isAvailable = isRouteAvailableForBooking(route);
            return (
              <div key={route.routeId} className="route-card">
                {/* Card Image */}
                <div className="card-image">
                  <img
                    src={
                      route.images?.[0]?.url || 
                      route.images?.[0] || 
                      route.driverImage || 
                      route.companyLogo
                    }
                    alt={`${route.fromLocation} to ${route.toLocation}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/placeholder.svg";
                    }}
                  />

                  {/* Badges */}
                  <div className="badge-featured">★ FEATURED</div>
                  <div className="my-badge-verified">
                    <span className="verified-icon">✓</span> VERIFIED
                  </div>

                  {/* Image Overlay Info */}
                  <div className="image-overlay">
                    <div className="image-info-left">
                      <span className="year-info">{route.vehicleModel}</span>
                      <h3 className="vehicle-type">{route.operator}</h3>
                    </div>
                    <div className="seats-badge">
                      <span className="seats-icon">🔴</span>
                      {route.availableSeats}/{route.totalSeats} Seats Left
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="card-content">
                  {/* Company Info */}
                  <div className="company-section">
                    <div className="company-header">
                      <img
                        src={
                          route.companyLogo ||
                          route.driverImage ||
                          "/placeholder.svg"
                        }
                        alt={route.operator || "Provider"}
                        className="company-logo"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/placeholder.svg";
                        }}
                      />
                      <div className="company-info">
                        <h4 className="company-name">
                          {route.operator || route.driverName || "Unknown Provider"}
                        </h4>
                      </div>

                      <div className="rating-badge">
                        <span className="star">★</span> {route.rating || "4.5"}
                      </div>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div className="available-featured-detail-group">
                    <label className="detail-label">Available Days</label>
                    <div className="available-days">
                      {route.availableDays?.map((day) => (
                        <span
                          key={day}
                          className={`day-pill ${
                            ["SAT", "SUN"].includes(day) ? "weekend" : ""
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="locations-section">
                    <div className="location-item">
                      <span className="location-dot">●</span>
                      <span className="location-name">
                        {route.fromLocation}
                      </span>
                    </div>

                    <div className="location-item">
                      <span className="location-dot">●</span>
                      <span className="location-name">{route.toLocation}</span>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="frequency-section">
                    <span className="calendar-icon">📅</span>{" "}
                    {getDaysFrequency(route.daysOfWeek || route.availableDays)}
                  </div>

                  {/* Timings */}
                  <div className="featured-detail-group">
                    <label className="detail-label">Arrival Time</label>
                    <p className="detail-value">
                      <span className="detail-icon">🕐</span>
                      {route.pickupArrivalTime &&
                        route.pickupArrivalTime !== "N/A" && (
                          <span className="arrival-time">
                            {normalizeTime(route.pickupArrivalTime)}
                          </span>
                        )}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="pricing-section">
                    <label className="pricing-label">PRICING BREAKDOWN</label>
                    <div className="pricing-row">
                      <span className="pricing-title">Monthly Pass</span>
                      <span className="pricing-value">
                        {route.monthlyPrice}
                      </span>
                    </div>
                  </div>

                  {/* Book Button */}
                  <button
                    className="book-button"
                    disabled={!isAvailable}
                    onClick={() => handleBookRoute(route)}
                    title={
                      !isAvailable
                        ? "Route not available. Check start date and available days."
                        : "Click to book this route"
                    }
                  >
                    {isAvailable ? "Book This Route" : "Not Available"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBookingModal && selectedRoute && (
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

export default FeaturedRoutes;
