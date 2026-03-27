"use client"

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import Notifications from "./Notifications/Notifications"
import api from "../../../utils/api";
import "./AdminHeader.css"

function AdminHeader() {

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  
  const [showNotifications, setShowNotifications] = useState(false)
const [formattedLastLogin, setFormattedLastLogin] = useState("");

// Format last login time
useEffect(() => {
  if (auth.user?.lastLogin) {
    const loginDate = new Date(auth.user.lastLogin);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateString = "";

    // Check if login is today
    if (loginDate.toDateString() === today.toDateString()) {
      dateString = "Today";
    }
    // Check if login is yesterday
    else if (loginDate.toDateString() === yesterday.toDateString()) {
      dateString = "Yesterday";
    }
    // Otherwise show the date
    else {
      dateString = loginDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const timeString = loginDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    setFormattedLastLogin(`${dateString}, ${timeString}`);
  }
}, [auth.user?.lastLogin]);

const getRoleDisplayName = (role) => {
  const roleMap = {
    ADMIN: "Admin",
    COMMUTER: "Commuter",
    CORPORATE: "Corporate",
    B2C_PARTNER: "B2C Partner",
    B2B_PARTNER: "B2B Partner",
    CORPORATE_DRIVER: "Corporate Driver",
    B2B_PARTNER_DRIVER: "B2B Partner Driver",
    CORPORATE_EMPLOYEE: "Corporate Employee",
    B2C_PARTNER_DRIVER: "B2C Partner Driver",
  };
  return roleMap[role] || role;
};

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No token found, redirecting to login");
        navigate("/login");
        return;
      }

      dispatch(logout());

      // Call backend logout endpoint to clear cookies and session
      await api.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      // Clear frontend storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      console.log("User logged out successfully");

      // Redirect to login page
      navigate("/admin-login");
    } catch (err) {
      console.error("Logout error:", err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login regardless of error
      navigate("/admin-login");
    }
  };

   const userName = auth.user?.fullName || "User";
   const userRole = auth.user?.role || "ADMIN";

  return (
    <header className="ad-dash-header">
      <div className="ad-dash-header-content">
        <div className="ad-dash-header-left">
          <div className="ad-dash-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" fill="#00A699" />
              <rect x="13" y="3" width="7" height="7" fill="#00A699" />
              <rect x="3" y="13" width="7" height="7" fill="#00A699" />
              <rect x="13" y="13" width="7" height="7" fill="#00A699" />
            </svg>
            <h1>Admin Control Center</h1>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <div className="ad-dash-user-info">
            <div className="ad-dash-user-details">
              <span className="ad-dash-user-name">
                {getRoleDisplayName(userRole)}
              </span>
              <span className="ad-dash-user-login">
                Last login: {formattedLastLogin || "Never"}
              </span>
            </div>
            <div className="notification-wrapper">
              <button
                className="ad-dash-notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2C6.68629 2 4 4.68629 4 8V11.5858L2.70711 12.8787C2.07714 13.5087 2.52331 14.6 3.41421 14.6H16.5858C17.4767 14.6 17.9229 13.5087 17.2929 12.8787L16 11.5858V8C16 4.68629 13.3137 2 10 2Z"
                    fill="currentColor"
                  />
                  <path
                    d="M10 18C11.1046 18 12 17.1046 12 16H8C8 17.1046 8.89543 18 10 18Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <Notifications
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>
          </div>
          <div className="drivemego-admin-ad-dash-logout-btn-header-right">
            <button
              className="drivemego-admin-ad-dash-logout-btn"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader
