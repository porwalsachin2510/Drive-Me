"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import "./navbar.css";
import { useNavigate } from "react-router-dom";
import WalletIcon from "./WalletIcon";
import NotificationIcon from "./NotificationIcon";
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
    setActiveTab(tab);
    localStorage.setItem("activeTab", tab);
    setMobileMenuOpen(false);
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
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo" onClick={() => navigate("/")}>
          <div className="logo-box">driveMe</div>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Nav Items */}
        <div className={`navbar-items ${mobileMenuOpen ? "active" : ""}`}>
          <div className="nav-tabs">
          </div>

          {isAuthenticated ? (
            // After Login: Show user avatar with dropdown and notifications
            <div className="nav-user-section">
              {/* Wallet Icon */}
              <WalletIcon />

              {/* Notification Icon */}
              <NotificationIcon />

              {/* User Avatar */}
              <button
                className="user-avatar"
                onClick={handleMyProfile}
                title="Click to go to profile"
                aria-label="User profile"
              >
                {userInitial}
              </button>
            </div>
          ) : (
            // Before Login: Show login button
            <button className="nav-login" onClick={handleLogin}>
              <span className="login-arrow">→</span> Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
