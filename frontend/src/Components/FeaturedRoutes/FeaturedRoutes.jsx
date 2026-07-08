import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import BookingModal from "../BookingModal/BookingModal";
import RoleRestrictionModal from "../RoleRestrictionModal/RoleRestrictionModal";
import { normalizeTime } from "../../utils/helperutility";
import { storeNavigationState } from "../../utils/loginRedirect";
import { useLocale } from "../../hooks/useLocale";
import "./featuredroutes.css";

const FeaturedRoutes = ({ routes, loading }) => {
  const { currency: localeCurrency } = useLocale();
  const [filters, setFilters] = useState({
    location: "",
    rating: "Any Rating",
  });

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRoleRestrictionModal, setShowRoleRestrictionModal] =
    useState(false);

  const auth = useSelector((state) => state.auth);
  const navigate = useNavigate();

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
            stop.toLowerCase().includes(locationLower),
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

  // Parse "7:30 AM" style strings to minutes for sorting trip times.
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === "N/A") return Infinity;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return Infinity;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    else if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Distinct, time-sorted departure times for a route. Round-trip tripTimes
  // contribute both their outbound and return leg times so every boardable time
  // is shown.
  const getRouteTripTimes = (route) => {
    const times = new Set();
    const source =
      route.tripTimes && route.tripTimes.length > 0
        ? route.tripTimes
        : route.upcomingTrips || [];
    source.forEach((trip) => {
      if (trip.departureTime) times.add(trip.departureTime);
      if (trip.tripType === "Round Trip") {
        if (trip.returnDepartureTime) times.add(trip.returnDepartureTime);
        else if (trip.arrivalTime) times.add(trip.arrivalTime);
      }
      if (!trip.departureTime && trip.time) times.add(trip.time);
    });
    return Array.from(times).sort(
      (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b),
    );
  };

  // START: CALCULATE DAYS OF WEEK FREQUENCY
  const getDaysFrequency = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return "5 Days/Week";
    return `${daysArray.length} Days/Week`;
  };
  // END: CALCULATE DAYS OF WEEK FREQUENCY

  // START: CALCULATE MONTHLY PRICE FROM ONE-WAY PRICE
  const calculateMonthlyPrice = (route) => {
    // If route already has monthlyPrice, use it
    if (route.monthlyPrice && route.monthlyPrice !== "N/A") {
      return typeof route.monthlyPrice === "number"
        ? `${route.monthlyPrice.toFixed(2)} ${route.pricing?.currency || localeCurrency}`
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
    const currency = route.pricing?.currency || localeCurrency;
    return `${monthlyPrice.toFixed(2)} ${currency}`;
  };
  // END: CALCULATE MONTHLY PRICE FROM ONE-WAY PRICE

  const isRouteAvailableForBooking = (route) => {
    // Advance booking is allowed at ANY time as long as seats are available.
    // A future start date does NOT block booking — the commuter simply reserves
    // in advance and the rides begin on the route's start date. Likewise, the
    // route's operating days only decide which days trips run, not whether a
    // commuter can subscribe today.

    // Genuinely full route -> not bookable.
    const seats = route.availableSeats;
    if (seats !== undefined && seats !== null && Number(seats) <= 0) {
      return false;
    }

    // Route explicitly closed / deactivated -> not bookable.
    if (route.isActive === false) return false;
    const status = (route.status || "").toString().toLowerCase();
    if (
      ["inactive", "cancelled", "canceled", "completed", "expired"].includes(
        status,
      )
    ) {
      return false;
    }

    // If the route has already ended, it can no longer be booked.
    if (route.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(route.endDate);
      endDate.setHours(0, 0, 0, 0);
      if (!isNaN(endDate.getTime()) && endDate < today) {
        return false;
      }
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

  return (
    <div className="drivemego-featuredroutes-featured-section">
      {/* Header */}

      <div className="drivemego-featuredroutes-featured-header">
        <div className="drivemego-featuredroutes-header-content">
          <h2 className="drivemego-featuredroutes-featured-title">
            <span className="drivemego-featuredroutes-star-icon">★</span>{" "}
            Featured Routes & Trips
          </h2>
          <p className="drivemego-featuredroutes-featured-subtitle">
            Curated high-quality commutes with verified providers
          </p>
        </div>

        {/* Filter Bar */}
        <div className="drivemego-featuredroutes-filter-bar">
          <div className="drivemego-featuredroutes-filter-text">
            <label className="drivemego-featuredroutes-filter-label drivemego-featuredroutes-mar">
              Location
            </label>

            <label className="drivemego-featuredroutes-filter-label">
              Min Rating
            </label>
          </div>

          <div className="drivemego-featuredroutes-filter-btn">
            <div className="drivemego-featuredroutes-filter-group">
              <div className="drivemego-featuredroutes-filter-input-wrapper">
                <input
                  type="text"
                  placeholder="Filter by area..."
                  value={filters.location}
                  onChange={handleLocationChange}
                  className="drivemego-featuredroutes-filter-input"
                />
              </div>
            </div>

            <div className="drivemego-featuredroutes-filter-group">
              <select
                value={filters.rating}
                onChange={handleRatingChange}
                className="drivemego-featuredroutes-filter-select"
              >
                <option>Any Rating</option>
                <option>4.0+</option>
                <option>4.5+</option>
                <option>4.8+</option>
              </select>
            </div>

            <button
              className="drivemego-featuredroutes-reset-button"
              onClick={handleReset}
            >
              <span className="drivemego-featuredroutes-filter-icon">⚙</span>{" "}
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      {!loading && filteredRoutes.length > 0 && (
        <div className="drivemego-featuredroutes-routes-grid">
          {filteredRoutes.map((route) => {
            const isAvailable = isRouteAvailableForBooking(route);
            return (
              <div
                key={route.routeId}
                className="drivemego-featuredroutes-route-card"
              >
                {/* Card Image */}
                <div className="drivemego-featuredroutes-card-image">
                  <img
                    src={
                      route.images?.[0]?.url ||
                      route.images?.[0] ||
                      route.driverImage ||
                      route.companyLogo ||
                      "/placeholder-banner.svg"
                    }
                    alt={`${route.fromLocation} to ${route.toLocation}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/placeholder-bannner.svg";
                    }}
                  />

                  {/* Badges */}
                  <div className="drivemego-featuredroutes-badge-featured">
                    ★ FEATURED
                  </div>
                  <div className="drivemego-featuredroutes-my-badge-verified">
                    <span className="drivemego-featuredroutes-verified-icon">
                      ✓
                    </span>{" "}
                    VERIFIED
                  </div>

                  {/* Image Overlay Info */}
                  <div className="drivemego-featuredroutes-image-overlay">
                    <div className="drivemego-featuredroutes-image-info-left">
                      <span className="drivemego-featuredroutes-year-info">
                        {route.vehicleModel}
                      </span>
                      <h3 className="drivemego-featuredroutes-vehicle-type">
                        {route.operator}
                      </h3>
                    </div>
                    <div className="drivemego-featuredroutes-seats-badge">
                      <span className="drivemego-featuredroutes-seats-icon">
                        🔴
                      </span>
                      {route.availableSeats}/{route.totalSeats} Seats Left
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="drivemego-featuredroutes-card-content">
                  {/* Company Info */}
                  <div className="drivemego-featuredroutes-company-section">
                    <div className="drivemego-featuredroutes-company-header">
                      <img
                        src={
                          route.profileImage ||
                          route.operatorImage ||
                          route.companyLogo ||
                          route.driverImage ||
                          "/placeholder.svg"
                        }
                        alt={route.operator || "Provider"}
                        className="drivemego-featuredroutes-company-logo"
                        style={{
                          borderRadius: "50%",
                          width: "50px",
                          height: "50px",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/placeholder-bannner.svg";
                        }}
                      />
                      <div className="drivemego-featuredroutes-company-info">
                        <h4 className="drivemego-featuredroutes-company-name">
                          {route.operator ||
                            route.driverName ||
                            "Unknown Provider"}
                        </h4>
                      </div>

                      <div className="drivemego-featuredroutes-rating-badge">
                        <span className="drivemego-featuredroutes-star">★</span>{" "}
                        {route.rating || "4.5"}
                      </div>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div className="drivemego-featuredroutes-available-featured-detail-group">
                    <label className="drivemego-featuredroutes-detail-label">
                      Available Days
                    </label>
                    <div className="drivemego-featuredroutes-available-days">
                      {route.availableDays?.map((day) => (
                        <span
                          key={day}
                          className={`drivemego-featuredroutes-day-pill ${
                            ["SAT", "SUN"].includes(day)
                              ? "drivemego-featuredroutes-weekend"
                              : ""
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="drivemego-featuredroutes-locations-section">
                    <div className="drivemego-featuredroutes-location-item">
                      <span className="drivemego-featuredroutes-location-dot">
                        ●
                      </span>
                      <span className="drivemego-featuredroutes-location-name">
                        {route.fromLocation}
                      </span>
                    </div>

                    <div className="drivemego-featuredroutes-location-item">
                      <span className="drivemego-featuredroutes-location-dot">
                        ●
                      </span>
                      <span className="drivemego-featuredroutes-location-name">
                        {route.toLocation}
                      </span>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="drivemego-featuredroutes-frequency-section">
                    <span className="drivemego-featuredroutes-calendar-icon">
                      Calendar
                    </span>{" "}
                    {getDaysFrequency(route.daysOfWeek || route.availableDays)}
                  </div>

                  {/* Trip Times - Show available departure times */}
                  <div className="drivemego-featuredroutes-featured-detail-group">
                    <label className="drivemego-featuredroutes-detail-label">
                      Trip Times
                    </label>
                    <div className="drivemego-featuredroutes-trip-times">
                      {(() => {
                        const allTimes = getRouteTripTimes(route);
                        if (allTimes.length > 0) {
                          return (
                            <>
                              {allTimes.slice(0, 3).map((time, idx) => (
                                <span
                                  key={idx}
                                  className="drivemego-featuredroutes-trip-time-badge"
                                >
                                  {normalizeTime(time)}
                                </span>
                              ))}
                              {allTimes.length > 3 && (
                                <span className="drivemego-featuredroutes-more-times">
                                  +{allTimes.length - 3} more
                                </span>
                              )}
                            </>
                          );
                        }
                        if (route.departureTime) {
                          return (
                            <span className="drivemego-featuredroutes-trip-time-badge">
                              {normalizeTime(route.departureTime)}
                            </span>
                          );
                        }
                        return (
                          <span className="drivemego-featuredroutes-no-time">
                            Click to view times
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="drivemego-featuredroutes-pricing-section">
                    <label className="drivemego-featuredroutes-pricing-label">
                      PRICING BREAKDOWN
                    </label>
                    <div className="drivemego-featuredroutes-pricing-row">
                      <span className="drivemego-featuredroutes-pricing-title">
                        Monthly Pass
                      </span>
                      <span className="drivemego-featuredroutes-pricing-value">
                        {calculateMonthlyPrice(route)}
                      </span>
                    </div>
                  </div>

                  {/* Book Button */}
                  <button
                    className="drivemego-featuredroutes-book-button"
                    disabled={!isAvailable}
                    onClick={() => handleBookRoute(route)}
                    title={
                      !isAvailable
                        ? "This route is fully booked or no longer available."
                        : "Click to book this route in advance"
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

      {/* Empty state when no routes have been featured by an admin yet */}
      {!loading && filteredRoutes.length === 0 && (
        <div className="drivemego-featuredroutes-empty">
          <span className="drivemego-featuredroutes-empty-icon">★</span>
          <h3 className="drivemego-featuredroutes-empty-title">
            No featured routes yet
          </h3>
          <p className="drivemego-featuredroutes-empty-text">
            Curated routes will appear here once our team highlights the best
            commutes for you. Browse all available routes below in the meantime.
          </p>
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

export default FeaturedRoutes;
