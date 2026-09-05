import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import api from "../../../utils/api";
import "./b2c_partner_header.css";

function B2C_Partner_Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);

  const [formattedLastLogin, setFormattedLastLogin] = useState("");

  const [profileData, setProfileData] = useState({
    fullName: auth?.user?.fullName || "Driver",
    profileImage: null,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/b2c-partner/profile");
      if (response.data.success) {
        setProfileData({
          fullName: response.data.profile.fullName,
          profileImage: response.data.profile.profileImage,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

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
    <header className="b2c-header">
      <div className="b2c-header-left">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {profileData.profileImage && (
            <img
              src={profileData.profileImage}
              alt="Profile"
              style={{
                width: "45px",
                height: "45px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #e74c3c",
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}
          <div>
            <h1 className="b2c-header-title">Driver Dashboard</h1>
            <p className="b2c-header-subtitle">
              Welcome back, {profileData.fullName}
            </p>
          </div>
        </div>
      </div>

      <div className="b2c-header-right">
        {/* <div className="b2c-header-stats">
          <div className="b2c-b2c-stat-item">
            <span className="b2c-b2c-stat-label">RATING</span>
            <div className="b2c-b2c-stat-value">
              4.8
              <span className="b2c-star-icon">★</span>
            </div>
          </div>

          <div className="b2c-stat-item">
            <span className="b2c-stat-label">TRIPS</span>
            <div className="b2c-stat-value">1,240</div>
          </div>

          <div className="b2c-stat-item">
            <span className="b2c-stat-label">ACCEPTANCE</span>
            <div className="b2c-stat-value b2c-acceptance-value">98%</div>
          </div>
        </div> */}

        {/* User Info Header */}
        <div className="b2c-header-right-inside">
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
          <button className="logout-btn" onClick={handleLogout}>
            <span>↗️</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default B2C_Partner_Header;
