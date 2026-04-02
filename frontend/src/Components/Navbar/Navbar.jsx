/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import "./navbar.css";
import { useNavigate, useLocation } from "react-router-dom";
import WalletIcon from "./WalletIcon";
import NotificationIcon from "./NotificationIcon";
import Logo from "../../assets/Logo.png";
import {
  selectIsAuthenticated,
  selectLoading,
} from "../../Redux/selectors/authSelectors";

export default function Navbar({ activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectLoading);

  const navigate = useNavigate();
  const location = useLocation();

  // Determine active mode based on current path or activeTab
  const getActiveMode = () => {
    const path = location.pathname;
    if (
      path.startsWith("/service-selection") ||
      path.startsWith("/corporate") ||
      path.startsWith("/search-results") ||
      path.startsWith("/view-single-vehicle-owner")
    ) {
      return "corporate";
    }
    return activeTab || "commuters";
  };

  const currentMode = getActiveMode();

  const roleRedirectMap = {
    COMMUTER: "/commuter-profile",
    CORPORATE: "/corporate-profile",
    B2C_PARTNER: "/",
    B2B_PARTNER: "/",
    ADMIN: "/",
    CORPORATE_EMPLOYEE: "/employee-dashboard",
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
    handleTabClick("corporate");
    navigate("/service-selection");
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
    return <nav className="navbar loading" />; // Prevent layout shift
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
            </div>
          )}

          {isAuthenticated ? (
            // After Login: Show user avatar with dropdown and notifications
            <div className="drivemego-topbar-nav-user-section">
              {user?.role &&
                ["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"].includes(user.role) && (
                  <WalletIcon />
                )}

              {/* Notification Icon */}
              <NotificationIcon />

              {/* User Avatar */}
              <button
                className="drivemego-topbar-user-avatar"
                onClick={handleMyProfile}
                title="Click to go to profile"
                aria-label="User profile"
              >
                {userInitial}
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
