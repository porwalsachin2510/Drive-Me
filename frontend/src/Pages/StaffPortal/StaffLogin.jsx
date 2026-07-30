import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBriefcase, FiEye, FiEyeOff } from "react-icons/fi";
import { portalLogin } from "../../services/demandPortalAPI";
import "./StaffPortal.css";

const StaffLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Email and password are required");
      return;
    }
    try {
      setLoading(true);
      const res = await portalLogin({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (res?.success) {
        const role = res.employee?.portalRole;
        navigate(role === "FINANCE" ? "/staff/finance" : "/staff/field", {
          replace: true,
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp-root">
      <div className="sp-login-wrap">
        <form className="sp-login-card" onSubmit={handleSubmit}>
          <span className="sp-login-badge">
            <FiBriefcase /> Demand Generation
          </span>
          <h1>Staff Portal</h1>
          <p className="sp-sub">
            Sign in to work your leads or manage payouts.
          </p>

          {error && <div className="sp-login-error">{error}</div>}

          <div className="sp-field">
            <label htmlFor="sp-email">Email address</label>
            <input
              id="sp-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="sp-field">
            <label htmlFor="sp-password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="sp-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                }}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="sp-btn sp-btn-primary sp-btn-block"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StaffLogin;
