import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginSuccess,
  authError,
  clearError,
} from "../../Redux/slices/authSlice";
import api from "../../utils/api";
import "./OTPVerification.css";

const OTPVerification = ({ email, onBack, onSuccess }) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Timer for resend button
  React.useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (pastedData.length === 6 && /^\d+$/.test(pastedData)) {
      setOtp(pastedData.split(""));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      dispatch(authError("Please enter all 6 digits"));
      return;
    }

    setLoading(true);
    dispatch(clearError());

    try {
      const response = await api.post("/auth/verify-otp", {
        email: email,
        otp: otpValue,
      });

      if (response.data.success) {
        // Every role (including COMMUTER) is auto-logged-in after OTP
        // verification — there is no admin approval gate anymore.
        dispatch(
          loginSuccess({
            user: response.data.user,
            token: response.data.token,
          }),
        );

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // Call success callback or navigate based on user role
        if (onSuccess) {
          onSuccess(response.data.user);
        } else {
          const roleRedirectMap = {
            COMMUTER: "/commuter-profile",
            CORPORATE: "/corporate-profile",
            B2C_PARTNER: "/b2c-partner-profile",
            B2B_PARTNER: "/b2b-partner-profile",
          };

          const userRole = response.data.user?.role;
          const redirectPath = roleRedirectMap[userRole] || "/dashboard";

          setTimeout(() => {
            navigate(redirectPath);
          }, 1500);
        }
      }
    } catch (err) {
      dispatch(
        authError(
          err.response?.data?.message ||
            "Verification failed. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setResending(true);
    dispatch(clearError());

    try {
      const response = await api.post("/auth/resend-otp", {
        email: email,
      });

      if (response.data.success) {
        // Reset timer and OTP inputs
        setTimeLeft(600);
        setCanResend(false);
        setOtp(["", "", "", "", "", ""]);

        // Focus first input
        const firstInput = document.getElementById("otp-0");
        if (firstInput) firstInput.focus();
      }
    } catch (err) {
      dispatch(
        authError(
          err.response?.data?.message || "Failed to resend verification code.",
        ),
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="otp-verification-container">
      <div className="otp-verification-card">
        <div className="otp-header">
          <button className="otp-back-btn" onClick={onBack} type="button">
            ← Back
          </button>
          <h2 className="otp-title">Verify Your Email</h2>
          <p className="otp-subtitle">
            We've sent a 6-digit verification code to
            <br />
            <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="otp-form">
          <div className="otp-input-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]"
                maxLength="1"
                className="otp-input"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                required
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className="otp-timer">
            {timeLeft > 0 ? (
              <p className="timer-text">
                Code expires in{" "}
                <span className="timer-value">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <p className="timer-expired">Code expired</p>
            )}
          </div>

          <button
            type="submit"
            className="otp-verify-btn"
            disabled={loading || otp.join("").length !== 6}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

          <div className="otp-resend-section">
            <p className="resend-text">Didn't receive the code?</p>
            <button
              type="button"
              className={`otp-resend-btn ${canResend ? "enabled" : "disabled"}`}
              onClick={handleResend}
              disabled={!canResend || resending}
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </form>

        <div className="otp-security-notice">
          <div className="security-icon">🔒</div>
          <div className="security-text">
            <h4>Security Notice</h4>
            <p>
              Never share this verification code with anyone. DriveMe staff will
              never ask for your OTP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
