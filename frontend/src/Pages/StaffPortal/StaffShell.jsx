import React from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiTrendingUp } from "react-icons/fi";
import {
  portalLogout,
  getPortalEmployee,
} from "../../services/demandPortalAPI";
import NotificationBell from "./NotificationBell";
import "./StaffPortal.css";

/**
 * Shared chrome for the Staff Portal (topbar + logout). Children render the
 * role-specific dashboard.
 */
const StaffShell = ({ subtitle, children }) => {
  const navigate = useNavigate();
  const employee = getPortalEmployee();

  const handleLogout = () => {
    portalLogout();
    navigate("/staff-login", { replace: true });
  };

  const initials = (employee?.fullName || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="sp-root">
      <div className="sp-topbar">
        <div className="sp-topbar-left">
          <div className="sp-logo">
            <FiTrendingUp />
          </div>
          <div>
            <h2>Demand Generation Portal</h2>
            <div className="sp-who">{subtitle}</div>
          </div>
        </div>
        <div className="sp-topbar-right">
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {employee?.fullName}
            </div>
            <div className="sp-who">{employee?.employeeCode}</div>
          </div>
          <div
            className="sp-logo"
            style={{ background: "#e2e8f0", color: "#334155" }}
          >
            {initials}
          </div>
          <NotificationBell />
          <button className="sp-btn sp-btn-sm" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>
      </div>
      <div className="sp-container">{children}</div>
    </div>
  );
};

export default StaffShell;
