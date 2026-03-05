"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { loginSuccess } from "../../Redux/slices/authSlice";
import api from "../../utils/api";
import Navbar from "../../Components/Navbar/Navbar";
import Footer from "../../Components/Footer/Footer";
import "./SetPassword.css";

const SetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [activeTab, setActiveTab] = useState("commuters");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Invalid or missing token. Please check your invitation email.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/auth/validate-password-token/${token}`);
        if (response.data.success) {
          setUserData(response.data.data);
          setTokenValid(true);
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
          "Invalid or expired token. Please contact your corporate admin for a new invitation."
        );
        setTokenValid(false);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/auth/set-password", {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (response.data.success) {
        setSuccess(true);
        
        // Store credentials and login
        dispatch(
          loginSuccess({
            user: response.data.user,
            token: response.data.token,
          })
        );

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to set password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="set-password-container">
          <div className="set-password-card">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Validating your invitation...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="set-password-container">
          <div className="set-password-card">
            <div className="success-message">
              <div className="success-icon">&#10004;</div>
              <h2>Password Set Successfully!</h2>
              <p>Your account is now activated. Redirecting to dashboard...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="set-password-container">
          <div className="set-password-card">
            <div className="error-state">
              <div className="error-icon">&#10006;</div>
              <h2>Invalid Invitation</h2>
              <p>{error}</p>
              <Link to="/login" className="back-to-login-btn">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="set-password-container">
        <div className="set-password-card">
          <div className="set-password-header">
            <div className="set-password-icon">&#128274;</div>
            <h1 className="set-password-title">Set Your Password</h1>
            <p className="set-password-subtitle">
              Welcome, <strong>{userData?.fullName}</strong>! Please create a password for your account.
            </p>
          </div>

          <div className="user-info-box">
            <p><strong>Email:</strong> {userData?.email}</p>
          </div>

          {error && <div className="set-password-error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="set-password-form-group">
              <label className="set-password-form-label">New Password</label>
              <input
                type="password"
                className="set-password-form-input"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password (min 6 characters)"
                required
                minLength={6}
              />
            </div>

            <div className="set-password-form-group">
              <label className="set-password-form-label">Confirm Password</label>
              <input
                type="password"
                className="set-password-form-input"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className={`set-password-submit-btn ${submitting ? "loading" : ""}`}
              disabled={submitting}
            >
              {submitting ? "Setting Password..." : "Set Password & Login"}
            </button>
          </form>

          <div className="set-password-login-link">
            Already have a password? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SetPassword;
