import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import "./b2b_header.css";
import api from "../../../utils/api";

function B2B_Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const auth = useSelector((state) => state.auth);

  const [formattedLastLogin, setFormattedLastLogin] = useState("");

  // Format last login time
  useEffect(() => {
    if (auth.user?.lastLogin) {
      const loginDate = new Date(auth.user.lastLogin);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateString = "";

      if (loginDate.toDateString() === today.toDateString()) {
        dateString = "Today";
      } else if (loginDate.toDateString() === yesterday.toDateString()) {
        dateString = "Yesterday";
      } else {
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
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login regardless of error
      navigate("/login");
    }
  };

  const userName = auth.user?.fullName || "User";
  const userRole = auth.user?.role || "ADMIN";

  return (
    <header className="b2b-header">
      <div className="b2b-header-left">
        <div className="b2b-header-left-inside">
          <h1 className="b2b-header-title">Operator Dashboard</h1>
          <div className="b2b-verified-badge">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#1677B8" strokeWidth="1.5" />
              <path
                d="M6 8.5L7.5 10L10 6.5"
                stroke="#1677B8"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>VERIFIED PARTNER</span>
          </div>
        </div>
        <p className="b2b-header-subtitle">{`Welcome back, ${userName}`}</p>
      </div>
      <div className="b2b-header-right">
        {/* User Info Header */}
        <div className="b2b-header-right-inside">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#202124",
                }}
              >
                {getRoleDisplayName(userRole)}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#5f6368",
                  marginTop: "4px",
                }}
              >
                Last login: {formattedLastLogin || "Never"}
              </div>
            </div>
          </div>
          <button
            className="drivemego-b2b-partner-b2b-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}

export default B2B_Header;
