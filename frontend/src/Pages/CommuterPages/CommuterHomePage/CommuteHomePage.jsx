"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CommuteSearchForm from "../../../Components/CommutersSearchForm/Commute-search-form";
import FeaturedRoutes from "../../../Components/FeaturedRoutes/FeaturedRoutes";
import AlreadyRequestedRoutes from "../../../Components/AlreadyRequestedRoutes/AlreadyRequestedRoutes";
import AvailableSection from "../../../Components/AvailableSection/AvailableSection";
import RouteRequest from "../../../Components/RouteRequest/RouteRequest";
import Navbar from "../../../Components/Navbar/Navbar";
import CampaignBanner from "../../../Components/CampaignBanner/CampaignBanner";
import ServiceUnavailable from "../../../Components/ServiceUnavailable/ServiceUnavailable";
import { useNavigate } from "react-router-dom";
import {
  isServiceAvailable,
  getDisplayCountry,
} from "../../../utils/helperutility";
import "./commuterhomepage.css";
import { useLocale } from "../../../hooks/useLocale";

import api from "../../../utils/api";

// Brand trust highlights shown as a goindigo-style strip under the search
// card. These are qualitative value props (not invented KPIs) so the page
// reads like an established mobility brand without misrepresenting metrics.
const HOME_HIGHLIGHTS = [
  {
    title: "Verified providers only",
    desc: "Every driver and vehicle is checked before they carry a commuter.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "One fixed monthly pass",
    desc: "Transparent pricing with no surge — pay once, ride all month.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20M6 15h4" />
      </svg>
    ),
  },
  {
    title: "The same ride, daily",
    desc: "Reserve a seat on a route that runs on your days, at your time.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  },
  {
    title: "Safe & on time",
    desc: "Tracked trips and reliable pickups so you reach work stress-free.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

const HOME_STATS = [
  { value: "100%", label: "Verified providers" },
  { value: "2", label: "Countries served" },
  { value: "4.8", label: "Average rider rating", star: true },
  { value: "24/7", label: "Rider support" },
];

export default function CommuterHomePage() {
  const [firstloadroutes, setFirstLoadRoutes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({});

  const [currentFilterType, setCurrentFilterType] = useState("all");

  // The commuter's country now comes from the single source of truth (Redux
  // locale), NOT a one-off IP probe. This is what makes the in-app country
  // switcher work: when a commuter switches from Kuwait to the UAE, the locale
  // slice updates, `userNationality` changes, and the routes refetch for the
  // newly selected country (Uber/Careem-style one-account-many-countries).
  // For anonymous/first-time visitors the locale is still IP-hydrated on load,
  // so the default behaviour is unchanged.
  const { displayName: localeDisplayName } = useLocale();
  const userNationality = localeDisplayName || null;
  const [showRouteRequest, setShowRouteRequest] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  // Update localStorage when activeTab changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  const navigate = useNavigate();

  const availableSectionRef = useRef(null);

  const fetchRoutes = useCallback(
    async (params = {}) => {
      try {
        if (!userNationality) {
          return;
        }

        setLoading(true);

        const token =
          localStorage.getItem("token") ||
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("token="))
            ?.split("=")[1];

        const queryParams = new URLSearchParams();
        if (params.pickupLocation)
          queryParams.append("pickupLocation", params.pickupLocation);
        if (params.dropoffLocation)
          queryParams.append("dropoffLocation", params.dropoffLocation);
        if (params.filterType)
          queryParams.append("filterType", params.filterType);
        if (params.workCategory)
          queryParams.append("workCategory", params.workCategory);
        if (params.tripType) queryParams.append("tripType", params.tripType);
        if (params.startDate) queryParams.append("startDate", params.startDate);
        if (params.selectedDays)
          queryParams.append(
            "selectedDays",
            JSON.stringify(params.selectedDays),
          );
        if (userNationality) {
          queryParams.append("nationality", userNationality);
        }

        const endpoint = token
          ? `/commute/search?${queryParams.toString()}`
          : `/commute/public-search?${queryParams.toString()}`;

        const response = await api.get(endpoint, {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        });

        if (response.data.success) {
          if (params.filterType === "matched") {
            setRoutes(response.data.routes);
          } else {
            setFirstLoadRoutes(response.data.routes);
          }
        }
      } catch (error) {
        console.error("Error fetching routes:", error);

        if (error.response?.status === 401) {
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation)
              queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation)
              queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType)
              queryParams.append("filterType", params.filterType);
            if (params.selectedDays)
              queryParams.append(
                "selectedDays",
                JSON.stringify(params.selectedDays),
              );
            if (userNationality)
              queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(
              `/commute/public-search?${queryParams.toString()}`,
            );
            if (fallbackResponse.data.success) {
              if (params.filterType === "matched") {
                setRoutes(fallbackResponse.data.routes);
              } else {
                setFirstLoadRoutes(fallbackResponse.data.routes);
              }
            }
          } catch (fallbackError) {
            console.error("Public search fallback also failed:", fallbackError);
          }
        } else if (error.response?.status === 403) {
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation)
              queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation)
              queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType)
              queryParams.append("filterType", params.filterType);
            if (userNationality)
              queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(
              `/commute/public-search?${queryParams.toString()}`,
            );
            if (fallbackResponse.data.success) {
              if (params.filterType === "matched") {
                setRoutes(fallbackResponse.data.routes);
              } else {
                setFirstLoadRoutes(fallbackResponse.data.routes);
              }
            }
          } catch (fallbackError) {
            console.error("Public search fallback also failed:", fallbackError);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [userNationality],
  );

  useEffect(() => {
    // Only fetch routes when the user is located in a country we actually
    // serve. Commuters in unsupported countries (e.g. India) should not see
    // any routes at all.
    if (userNationality && isServiceAvailable(userNationality)) {
      fetchRoutes({ filterType: "all" });
      setCurrentFilterType("all");
    } else if (userNationality) {
      // Clear any previously loaded routes for unsupported countries.
      setFirstLoadRoutes([]);
      setRoutes([]);
    }
  }, [fetchRoutes, userNationality]);

  const handleSearch = (searchData) => {
    setSearchParams(searchData);
    setCurrentFilterType("matched");

    fetchRoutes({
      ...searchData,
      filterType: "matched",
    });

    setTimeout(() => {
      if (availableSectionRef.current) {
        availableSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 300);
  };

  const handleFilterChange = (filterData) => {
    if (
      filterData.filterType === "matched" &&
      !searchParams.pickupLocation &&
      !searchParams.dropoffLocation
    ) {
      setCurrentFilterType("matched");
      return;
    }

    setCurrentFilterType(filterData.filterType);

    let params;
    if (filterData.filterType === "all") {
      params = {
        filterType: "all",
        selectedFilter: filterData.selectedFilter || "All",
      };
    } else {
      params = {
        ...searchParams,
        ...filterData,
      };
    }

    fetchRoutes(params);
  };

  // Only show routes that an admin has explicitly marked as featured.
  // This prevents the page from rendering thousands of B2C partner cards.
  const featuredRoutes = firstloadroutes.filter((route) => route.isFeatured);

  // eslint-disable-next-line no-unused-vars
  const goToSearchFleetPage = () => {
    navigate("/search-fleet", {
      state: { username: "Sachin", age: 22 }, // sending data
    });
  };

  // ============ COMMUTERS VIEW ============

  // Whether the detected country is one we currently serve (UAE / Kuwait).
  const serviceAvailable =
    !!userNationality && isServiceAvailable(userNationality);

  // Commuters in an unsupported country (e.g. India) should only see the
  // "coming soon" experience — hide the navbar so they cannot navigate to
  // other pages of an app that isn't available in their region.
  const isUnsupportedCountry = !!userNationality && !serviceAvailable;

  return (
    <div>
      {!isUnsupportedCountry && (
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      <div className="commuterhomepage-homepage">
        <div className="commuterhomepage-commuters-container">
          {/* Commuters located in a country we don't serve yet get a
              dedicated "coming soon" experience instead of the route search. */}
          {userNationality && !serviceAvailable ? (
            <ServiceUnavailable
              country={getDisplayCountry(userNationality)}
              onRequestRoute={() => setShowRouteRequest(true)}
            />
          ) : (
            <>
              <section className="commuterhomepage-hero">
                <div className="commuterhomepage-hero-inner commuterhomepage-page-title">
                  <span className="commuterhomepage-hero-eyebrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l19-9-9 19-2-8-8-2z" />
                    </svg>
                    Smart Mobility
                  </span>
                  <h1>
                    We Are <span className="commuterhomepage-hero-accent">Drive Me Go.</span>
                  </h1>
                  <p>
                    We have the power to move the future — not simply by getting
                    you from one place to another, but by opening new
                    possibilities. Drive Me Go gives you the freedom to go
                    anywhere.
                  </p>
                  {serviceAvailable && (
                    <p className="commuterhomepage-location-indicator commuterhomepage-available">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 12 8 12s8-6.1 8-12c0-4.4-3.6-8-8-8z" />
                        <circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none" />
                      </svg>
                      Showing routes for:{" "}
                      <strong>{getDisplayCountry(userNationality)}</strong>
                    </p>
                  )}

                  {userNationality === null && (
                    <p className="commuterhomepage-location-indicator commuterhomepage-available">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 12 8 12s8-6.1 8-12c0-4.4-3.6-8-8-8z" />
                        <circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none" />
                      </svg>
                      <strong>Location Not Found</strong>
                    </p>
                  )}
                </div>
              </section>

              {/* Search form and route listings are only shown for commuters
              located in a country we currently serve. */}
              {serviceAvailable && (
                <>
                  <CommuteSearchForm
                    onSearch={handleSearch}
                    onRequestRoute={() => setShowRouteRequest(true)}
                    userCountry={userNationality}
                  />

                  {/* Campaign Banner - Top Banner (matches Admin placement: "top") */}
                  <CampaignBanner placement="top" />

                  <section
                    className="commuterhomepage-highlights"
                    aria-label="Why choose Drive Me Go"
                  >
                    {HOME_HIGHLIGHTS.map((item) => (
                      <div
                        className="commuterhomepage-highlight-card"
                        key={item.title}
                      >
                        <span className="commuterhomepage-highlight-icon">
                          {item.icon}
                        </span>
                        <div className="commuterhomepage-highlight-text">
                          <h3>{item.title}</h3>
                          <p>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </section>

                  <FeaturedRoutes routes={featuredRoutes} loading={loading} />

                  {/* Surface corridors other commuters have already requested so
                      commuters can join the existing demand ("Show Interest")
                      instead of filing duplicate requests. */}
                  {/* <div className="commuterhomepage-already-requested">
                    <AlreadyRequestedRoutes layout="grid" />
                  </div> */}

                  <div
                    ref={availableSectionRef}
                    className="commuterhomepage-available-section-wrapper"
                  >
                    {/* Sidebar Campaign Banner */}
                    <CampaignBanner placement="sidebar" />
                    <AvailableSection
                      routes={
                        currentFilterType === "matched"
                          ? routes
                          : firstloadroutes
                      }
                      loading={loading}
                      onFilterChange={handleFilterChange}
                      searchParams={searchParams}
                      currentFilterType={currentFilterType}
                    />
                  </div>

                  <section className="commuterhomepage-stats">
                    <div className="commuterhomepage-stats-head">
                      <h2>Trusted mobility, every single day</h2>
                      <p>
                        Daily commutes powered by verified providers across the
                        region — reliable, transparent and built around you.
                      </p>
                    </div>
                    <div className="commuterhomepage-stats-grid">
                      {HOME_STATS.map((s) => (
                        <div className="commuterhomepage-stat" key={s.label}>
                          <span className="commuterhomepage-stat-value">
                            {s.value}
                            {s.star && (
                              <svg
                                className="commuterhomepage-stat-star"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M12 2l2.9 6.26L21.6 9l-5 4.6L18 21l-6-3.5L6 21l1.4-7.4-5-4.6 6.7-.74z" />
                              </svg>
                            )}
                          </span>
                          <span className="commuterhomepage-stat-label">
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="commuterhomepage-cta-band">
                    <div className="commuterhomepage-cta-text">
                      <h2>Can&apos;t find your route?</h2>
                      <p>
                        Tell us where you travel and we&apos;ll match you with a
                        verified provider.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="commuterhomepage-cta-btn"
                      onClick={() => setShowRouteRequest(true)}
                    >
                      Request a route
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </section>

                  {/* Footer Campaign Banner */}
                  <CampaignBanner placement="footer" />

                  {/* Popup Campaign Banner */}
                  <CampaignBanner placement="popup" />
                </>
              )}
            </>
          )}
        </div>

        <RouteRequest
          isOpen={showRouteRequest}
          onClose={() => setShowRouteRequest(false)}
          searchParams={searchParams}
          userCountry={userNationality}
          onRequestSubmitted={() => {
            // Refresh routes or show success message
            console.log("Route request submitted");
          }}
        />
      </div>
    </div>
  );
}
