"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import Navbar from "../../Components/Navbar/Navbar";
import Footer from "../../Components/Footer/Footer";
import "./forgotPassword.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState("email"); // 'email', 'otp', 'reset'
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/auth/forgot-password", { email });

      if (response.data.success) {
        setSuccess("OTP sent to your email. Please check your inbox.");
        setStep("otp");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to send OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/auth/verify-reset-otp", { email, otp });

      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setSuccess("OTP verified. Please set your new password.");
        setStep("reset");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.post("/auth/reset-password", {
        email,
        resetToken,
        newPassword,
      });

      if (response.data.success) {
        setSuccess("Password reset successful! Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to reset password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/auth/forgot-password", { email });

      if (response.data.success) {
        setSuccess("New OTP sent to your email.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <div className="forgot-password-header">
            <div className="forgot-password-icon">
              {step === "email" && "🔐"}
              {step === "otp" && "📧"}
              {step === "reset" && "🔑"}
            </div>
            <h1 className="forgot-password-title">
              {step === "email" && "Forgot Password"}
              {step === "otp" && "Verify OTP"}
              {step === "reset" && "Reset Password"}
            </h1>
            <p className="forgot-password-subtitle">
              {step === "email" &&
                "Enter your email to receive a verification code"}
              {step === "otp" && "Enter the OTP sent to your email"}
              {step === "reset" && "Create your new password"}
            </p>
          </div>

          {error && (
            <div className="forgot-password-error-message">{error}</div>
          )}
          {success && (
            <div className="forgot-password-success-message">{success}</div>
          )}

          {step === "email" && (
            <form onSubmit={handleSendOTP}>
              <div className="forgot-password-form-group">
                <label className="forgot-password-form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  className="forgot-password-form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button
                type="submit"
                className={`forgot-password-submit-btn ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOTP}>
              <div className="forgot-password-form-group">
                <label className="forgot-password-form-label">Enter OTP</label>
                <input
                  type="text"
                  className="forgot-password-form-input forgot-password-otp-input"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                className={`forgot-password-submit-btn ${loading ? "loading" : ""}`}
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <div className="forgot-password-resend">
                <span>Didn't receive the code? </span>
                <button
                  type="button"
                  className="forgot-password-resend-btn"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div className="forgot-password-form-group">
                <label className="forgot-password-form-label">
                  New Password
                </label>
                <input
                  type="password"
                  className="forgot-password-form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>

              <div className="forgot-password-form-group">
                <label className="forgot-password-form-label">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="forgot-password-form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className={`forgot-password-submit-btn ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="forgot-password-back-link">
            <Link to="/login">Back to Login</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ForgotPassword;
