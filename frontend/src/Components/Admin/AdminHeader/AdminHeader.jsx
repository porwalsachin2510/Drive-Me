"use client"

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bell, LogOut, Clock, ShieldCheck } from "lucide-react";
import { logout } from "../../../Redux/slices/authSlice";
import Notifications from "./Notifications/Notifications"
import api from "../../../utils/api";
import Logo from "../../../assets/Logo.png";
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
    SCHOOL_CUSTOMER: "School Customer",
    SCHOOL_PARTNER: "School Partner",
    SCHOOL_PARTNER_DRIVER: "School Partner Driver",
    SCHOOL_CUSTOMER_DRIVER: "School Customer Driver",
    SCHOOL_STUDENT: "School Student",
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
   const initials = (getRoleDisplayName(userRole) || "A")
     .split(" ")
     .map((w) => w[0])
     .join("")
     .slice(0, 2)
     .toUpperCase();

  return (
    <header className="ad-dash-header">
      <div className="ad-dash-header-content">
        <div className="ad-dash-header-left">
          <div className="ad-dash-logo">
            <img src={Logo || "/placeholder.svg"} alt="DriveMeGo" className="ad-dash-logo-img" />
            <span className="ad-dash-logo-badge">
              <ShieldCheck size={13} />
              Admin Control Center
            </span>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <div className="notification-wrapper">
            <button
              className="ad-dash-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <Bell size={19} />
              <span className="ad-dash-notification-dot" />
            </button>
            <Notifications
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          <div className="ad-dash-user-info">
            <div className="ad-dash-user-avatar">{initials}</div>
            <div className="ad-dash-user-details">
              <span className="ad-dash-user-name">
                {getRoleDisplayName(userRole)}
              </span>
              <span className="ad-dash-user-login">
                <Clock size={11} />
                {formattedLastLogin || "Never"}
              </span>
            </div>
          </div>

          <button
            className="drivemego-admin-ad-dash-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader
