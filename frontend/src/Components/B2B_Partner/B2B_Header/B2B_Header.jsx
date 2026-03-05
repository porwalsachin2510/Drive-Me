import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import "./b2b_header.css";
import api from "../../../utils/api";

function B2B_Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
        }
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
        <p className="b2b-header-subtitle">Welcome back, Royal Fleets Co.</p>
      </div>
      <div className="b2b-header-right">
        <button className="b2b-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </header>
  );
}

export default B2B_Header;
