import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginSuccess,
  authStart,
  authError,
  clearError,
} from "../../../Redux/slices/authSlice";
import {
  selectLoading,
  selectError,
} from "../../../Redux/selectors/authSelectors";
import api from "../../../utils/api";
import "./adminloginpage.css";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";

const AdminLoginPage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    dispatch(clearError());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(authStart());

    try {
      const response = await api.post(
        "/auth/login",
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data.success) {
        dispatch(
          loginSuccess({
            user: response.data.user,
            token: response.data.token,
          })
        );

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // Redirect to admin profile
        navigate("/");
      }
    } catch (err) {
      console.log(err.response?.data);
      dispatch(
        authError(
          err.response?.data?.message || "Login failed. Please try again."
        )
      );
    }
  };

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-icon-wrapper">
            <div className="admin-icon-circle">
              <svg
                className="admin-shield-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L4 6V11C4 16.55 7.84 21.74 12 23C16.16 21.74 20 16.55 20 11V6L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12L11 14L15 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <h1 className="admin-title">Admin Portal</h1>
          <p className="admin-subtitle">Secure System Access</p>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <div className="admin-form-group">
              <label htmlFor="email" className="admin-label">
                Administrator Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="admin-input"
                placeholder="admin@driveme.com"
                required
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="password" className="admin-label">
                Secure Password
              </label>
              <div className="admin-password-wrapper">
                <svg
                  className="admin-lock-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="admin-input admin-password-input"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <div className="admin-error-message">{error}</div>}

            <button
              type="submit"
              className="admin-submit-btn"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Authenticate"}
            </button>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AdminLoginPage;
