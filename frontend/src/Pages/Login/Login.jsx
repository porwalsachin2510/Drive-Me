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
import { showSuccess, showError } from "../../utils/toast";
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
    SCHOOL_CUSTOMER: "/",
    SCHOOL_PARTNER: "/",
    SCHOOL_PARTNER_DRIVER: "/",
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

        showSuccess(
          `Welcome back${response.data.user?.fullName ? `, ${response.data.user.fullName}` : ""}!`,
        );

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
        const message =
          err.response?.data?.message || "Login failed. Please try again.";
        dispatch(authError(message));
        showError(err, "Login failed. Please try again.");
      }
    }
  };

  const handleCloseSuspendedModal = () => {
    setShowSuspendedModal(false);
    setSuspensionDetails(null);
  };

  const LOGIN_TRUST = [
    {
      title: "Verified providers only",
      desc: "Every driver and vehicle is checked before they carry a commuter.",
    },
    {
      title: "One fixed monthly pass",
      desc: "Transparent pricing with no surge — pay once, ride all month.",
    },
    {
      title: "The same ride, daily",
      desc: "Reserve a seat on a route that runs on your days, at your time.",
    },
  ];

  return (
    <div className="login-page">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="login-container">
        <div className="login-shell">
          {/* Brand panel — mirrors the homepage hero (navy gradient + teal). */}
          <aside className="login-brand" aria-hidden="true">
            <div className="login-brand-glow" />
            <div className="login-brand-top">
              <span className="login-brand-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
              </span>
              <span className="login-brand-name">Drive Me Go</span>
            </div>

            <div className="login-brand-copy">
              <span className="login-brand-eyebrow">Welcome back</span>
              <h2 className="login-brand-title">
                Your daily commute, <br />
                <span className="login-brand-title-accent">
                  sorted for the whole month.
                </span>
              </h2>
              <p className="login-brand-sub">
                Sign in to manage your routes, track your rides and keep your
                seat on the commute that fits your day.
              </p>
            </div>

            <ul className="login-brand-points">
              {LOGIN_TRUST.map((item) => (
                <li key={item.title} className="login-brand-point">
                  <span className="login-brand-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="login-brand-point-text">
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="login-brand-trust">
              <div className="login-brand-trust-rating">
                <span className="login-brand-stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 7.1-1.01L12 2z" />
                    </svg>
                  ))}
                </span>
                <strong>4.9</strong>
                <span className="login-brand-trust-sub">/ 5 rider rating</span>
              </div>
              <span className="login-brand-trust-divider" />
              <div className="login-brand-trust-count">
                <strong>12,000+</strong>
                <span>daily commuters</span>
              </div>
            </div>
          </aside>

          {/* Form panel */}
          <section className="login-panel">
            <div className="login-card">
              <div className="login-header">
                <span className="login-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 16H9m10 0h1.5a1.5 1.5 0 0 0 1.5-1.5v-3.19a2 2 0 0 0-.59-1.42L18 5.59A2 2 0 0 0 16.58 5H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
                    <circle cx="6.5" cy="16.5" r="2.5" />
                    <circle cx="16.5" cy="16.5" r="2.5" />
                  </svg>
                </span>
                <h1 className="login-title">Sign in</h1>
                <p className="login-subtitle">
                  Welcome back — let&apos;s get you moving.
                </p>
              </div>

              {loginMessage && (
                <div className="login-info-message">{loginMessage}</div>
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
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
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
                          width="18"
                          height="18"
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

                <p className="login-secure-note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secured with 256-bit encryption
                </p>
              </form>

              <div className="login-signup-link">
                Don&apos;t have an account? <Link to="/register">Sign up</Link>
              </div>
            </div>
          </section>
        </div>
      </main>

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
