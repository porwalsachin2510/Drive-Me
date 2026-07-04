"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  loginSuccess,
  authStart,
  authError,
  clearError,
} from "../../Redux/slices/authSlice";
import {
  selectLoading,
  selectError,
} from "../../Redux/selectors/authSelectors";
import api from "../../utils/api";
import Navbar from "../../Components/Navbar/Navbar";
import SuspendedAccountModal from "../../Components/SuspendedAccountModal/SuspendedAccountModal";
import "./login.css";
import Footer from "../../Components/Footer/Footer";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  // const [error, setError] = useState("");
  // const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [suspensionDetails, setSuspensionDetails] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [pendingNotice, setPendingNotice] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnState = location.state?.returnState;
  const loginMessage = location.state?.message || pendingNotice;

  const dispatch = useDispatch();

  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);

  const roleRedirectMap = {
    COMMUTER: "/",
    CORPORATE: "/",
    B2C_PARTNER: "/",
    B2B_PARTNER: "/",
    CORPORATE_DRIVER: "/",
    B2B_PARTNER_DRIVER: "/",
    B2C_PARTNER_DRIVER: "/",
  };

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

    if (
      formData.email === "admin@driveme.com" &&
      formData.password === "Sachin123@"
    ) {
      navigate("/admin-login");
      return;
    }

    dispatch(authStart());

    try {
      const response = await api.post(
        "/auth/login",
        formData,
        {
          withCredentials: true,
        },
        { headers: { "Content-Type": "application/json" } },
      );

      if (response.data.success) {
        dispatch(
          loginSuccess({
            user: response.data.user,
            token: response.data.token,
          }),
        );

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        const userRole = response.data.user?.role;
        // If user came from a booking attempt, redirect back there
        if (returnTo) {
          // If there's return state, pass it along
          if (returnState) {
            navigate(returnTo, { state: returnState });
          } else {
            navigate(returnTo);
          }
        } else {
          const redirectPath = roleRedirectMap[userRole] || "/";
          navigate(redirectPath);
        }
      }
    } catch (err) {
      console.log(err.response?.data);
      // Check if the error is due to suspension
      if (
        err.response?.data?.isSuspended &&
        err.response?.data?.suspensionDetails
      ) {
        setSuspensionDetails(err.response.data.suspensionDetails);
        setShowSuspendedModal(true);
      } else {
        dispatch(
          authError(
            err.response?.data?.message || "Login failed. Please try again.",
          ),
        );
      }
    }
  };

  const handleCloseSuspendedModal = () => {
    setShowSuspendedModal(false);
    setSuspensionDetails(null);
  };

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">🚗</div>
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Sign in to your account</p>
          </div>

          {loginMessage && (
            <div
              className="login-info-message"
              style={{
                padding: "12px 16px",
                marginBottom: "16px",
                borderRadius: "8px",
                backgroundColor: "#e0f2fe",
                color: "#0369a1",
                fontSize: "14px",
                fontWeight: "500",
                border: "1px solid #bae6fd",
              }}
            >
              {loginMessage}
            </div>
          )}
          {error && <div className="login-error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label className="login-form-label">Email address</label>
              <input
                type="email"
                className="login-form-input"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="login-form-group">
              <label className="login-form-label">Password</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-form-input login-password-input"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-forgot-password">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className={`login-submit-btn ${loading ? "login-loading" : ""}`}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="login-signup-link">
            Don&apos;t have an account? <Link to="/register">Sign up</Link>
          </div>
        </div>
      </div>

      <Footer />
      {showSuspendedModal && suspensionDetails && (
        <SuspendedAccountModal
          suspensionDetails={suspensionDetails}
          onClose={handleCloseSuspendedModal}
        />
      )}
    </div>
  );
};

export default Login;
