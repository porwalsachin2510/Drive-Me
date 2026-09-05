/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import "./navbar.css";
import { useNavigate, useLocation } from "react-router-dom";
import WalletIcon from "./WalletIcon";
import NotificationIcon from "./NotificationIcon";
import CommuterLocationBadge from "./CommuterLocationBadge";
import Logo from "../../assets/Logo.png";
import {
  selectIsAuthenticated,
  selectLoading,
} from "../../Redux/selectors/authSelectors";
import { logout } from "../../Redux/slices/authSlice";
import api from "../../utils/api";

export default function Navbar({ activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectLoading);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Determine active mode based on current path or activeTab
  const getActiveMode = () => {
    const path = location.pathname;
    if (
      path.startsWith("/service-selection") ||
      path.startsWith("/corporate") ||
      path.startsWith("/search-results") ||
      path.startsWith("/view-single-vehicle-owner")
    ) {
      // The corporate and school-customer journeys share these routes. The
      // active business segment is persisted in localStorage so the correct
      // tab (Corporate vs School) stays highlighted.
      return localStorage.getItem("serviceSegment") === "school"
        ? "school"
        : "corporate";
    }
    return activeTab || "commuters";
  };

  const currentMode = getActiveMode();

  const roleRedirectMap = {
    COMMUTER: "/commuter-profile",
    CORPORATE: "/corporate-profile",
    SCHOOL_CUSTOMER: "/corporate-profile",
    B2C_PARTNER: "/",
    B2B_PARTNER: "/",
    ADMIN: "/",
    CORPORATE_EMPLOYEE: "/employee-dashboard",
    // A school customer's students/teachers use the same passenger dashboard.
    SCHOOL_STUDENT: "/employee-dashboard",
    B2C_PARTNER_DRIVER: "/",
    B2B_PARTNER_DRIVER: "/",
    CORPORATE_DRIVER: "/",
  };

  const contractroleRedirectMap = {
    COMMUTER: "/commuter",
    CORPORATE: "/corporate",
    B2C_PARTNER: "/b2c-partner",
    B2B_PARTNER: "/b2b-partner",
    ADMIN: "/admin",
  };

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleMyProfile = () => {
    if (user && user.role) {
      const profileUrl = roleRedirectMap[user.role] || "/login";
      navigate(profileUrl);
    } else {
      navigate("/login");
    }
  };

  const handleTabClick = (tab) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
    localStorage.setItem("activeTab", tab);
    setMobileMenuOpen(false);
  };

  const handleCommuterClick = () => {
    handleTabClick("commuters");
    navigate("/");
  };

  const handleCorporateClick = () => {
    // Corporate customers shop from B2B partners (passenger / goods / managed).
    localStorage.setItem("serviceSegment", "corporate");
    handleTabClick("corporate");
    navigate("/service-selection");
  };

  const handleSchoolClick = () => {
    // School customers shop from School partners and only ever take Managed
    // Services. The segment is persisted so the shared service-selection /
    // discovery routes render the school-only view.
    localStorage.setItem("serviceSegment", "school");
    handleTabClick("school");
    navigate("/service-selection");
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        await api.post(
          "/auth/logout",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }

      // Clear all local storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("activeTab");

      // Dispatch logout action
      dispatch(logout());

      // Navigate to login
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if API fails, clear local data and redirect
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("activeTab");
      dispatch(logout());
      navigate("/login");
    }
  };

  const handleContractTabClick = (tab) => {
    console.log("this tab clicked ", tab);
    setActiveTab(tab);
    localStorage.setItem("activeTab", tab);
    setMobileMenuOpen(false);

    if (user && user.role) {
      const contractUrl = contractroleRedirectMap[user.role] || "/login";
      navigate(contractUrl + "/contracts");
    } else {
      navigate("/login");
    }
  };

  // Get user initial for avatar
  const userInitial =
    user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  if (isLoading) {
    return <nav className="navbar" />; // Prevent layout shift
  }

  return (
    <nav
      className={`drivemego-topbar-navbar ${scrolled ? "drivemego-topbar-scrolled" : ""}`}
    >
      <div className="drivemego-topbar-navbar-container">
        {/* Logo */}
        <div
          className="drivemego-topbar-navbar-logo"
          onClick={() => navigate("/")}
        >
          <img
            src={Logo}
            alt="DriveMe"
            className="drivemego-topbar-navbar-logo-image"
          />
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="drivemego-topbar-mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Nav Items */}
        <div
          className={`drivemego-topbar-navbar-items ${mobileMenuOpen ? "drivemego-topbar-active" : ""}`}
        >
          {!isAuthenticated && (
            <div className="drivemego-topbar-nav-tabs">
              <button
                className={`drivemego-topbar-navbar-tab drivemego-topbar-commuter-tab ${currentMode === "commuters" ? "drivemego-topbar-active" : ""}`}
                onClick={handleCommuterClick}
              >
                <span className="drivemego-topbar-user-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                Commuters
              </button>
              <button
                className={`drivemego-topbar-navbar-tab drivemego-topbar-corporate-tab ${currentMode === "corporate" ? "drivemego-topbar-active" : ""}`}
                onClick={handleCorporateClick}
              >
                <span className="drivemego-topbar-building-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="4"
                      y="2"
                      width="16"
                      height="20"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M9 22v-4h6v4"></path>
                    <path d="M8 6h.01"></path>
                    <path d="M16 6h.01"></path>
                    <path d="M12 6h.01"></path>
                    <path d="M12 10h.01"></path>
                    <path d="M12 14h.01"></path>
                    <path d="M16 10h.01"></path>
                    <path d="M16 14h.01"></path>
                    <path d="M8 10h.01"></path>
                    <path d="M8 14h.01"></path>
                  </svg>
                </span>
                Corporate
              </button>
              <button
                className={`drivemego-topbar-navbar-tab drivemego-topbar-school-tab ${currentMode === "school" ? "drivemego-topbar-active" : ""}`}
                onClick={handleSchoolClick}
              >
                <span className="drivemego-topbar-school-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 6v6"></path>
                    <path d="M15 6v6"></path>
                    <path d="M2 12h19.6"></path>
                    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                    <circle cx="7" cy="18" r="2"></circle>
                    <path d="M9 18h5"></path>
                    <circle cx="16" cy="18" r="2"></circle>
                  </svg>
                </span>
                School
              </button>
            </div>
          )}

          {isAuthenticated ? (
            // After Login: Show user avatar with dropdown and notifications
            <div className="drivemego-topbar-nav-user-section">
              {/* Commuter location badge — a commuter's country is AUTO-DETECTED
                  from their real location (Uber/Careem style), so one account
                  works across every served country but only ever shows the
                  routes/prices of the country they are physically in. There is
                  no manual country picker. Earners are excluded: their country
                  is a locked business identity. */}
              {user?.role === "COMMUTER" && <CommuterLocationBadge />}

              {user?.role &&
                ["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER", "ADMIN"].includes(
                  user.role,
                ) && <WalletIcon />}

              {/* Notification Icon */}
              <NotificationIcon />

              {/* User Avatar */}
              <button
                className="drivemego-topbar-user-avatar"
                onClick={handleMyProfile}
                title="Click to go to profile"
                aria-label="User profile"
              >
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user?.name || "User"}
                    className="drivemego-topbar-user-avatar-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <span
                  className="drivemego-topbar-user-avatar-initial"
                  style={{ display: user?.profileImage ? "none" : "flex" }}
                >
                  {userInitial}
                </span>
              </button>

              {/* Logout Button */}
              <button
                className="drivemego-topbar-logout-btn"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          ) : (
            // Before Login: Show login button
            <button
              className="drivemego-topbar-nav-login"
              onClick={handleLogin}
            >
              <span className="drivemego-topbar-login-arrow">→</span> Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
