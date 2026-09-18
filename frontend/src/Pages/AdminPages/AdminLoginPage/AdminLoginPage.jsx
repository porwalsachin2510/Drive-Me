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

const ADMIN_TRUST = [
  {
    title: "Role-based access",
    desc: "Only verified administrators reach the platform control center.",
  },
  {
    title: "Full operational control",
    desc: "Users, revenue, routes and payments — managed from one console.",
  },
  {
    title: "Every action logged",
    desc: "Sensitive changes are tracked with a complete audit trail.",
  },
];

const AdminLoginPage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

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
      const response = await api.post("/auth/login", formData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.success) {
        dispatch(
          loginSuccess({
            user: response.data.user,
            token: response.data.token,
          }),
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
          err.response?.data?.message || "Login failed. Please try again.",
        ),
      );
    }
  };

  return (
    <div className="adm-login-page">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="adm-login-container">
        <div className="adm-login-shell">
          {/* Brand panel — navy gradient + teal, secure control-center messaging. */}
          <aside className="adm-login-brand" aria-hidden="true">
            <div className="adm-login-brand-glow" />
            <div className="adm-login-brand-top">
              <span className="adm-login-brand-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
              </span>
              <span className="adm-login-brand-name">Drive Me Go</span>
            </div>

            <div className="adm-login-brand-copy">
              <span className="adm-login-brand-eyebrow">Admin Control Center</span>
              <h2 className="adm-login-brand-title">
                Run the entire platform <br />
                <span className="adm-login-brand-title-accent">
                  from a single secure console.
                </span>
              </h2>
              <p className="adm-login-brand-sub">
                Sign in to manage users, monitor revenue, approve providers and
                keep every route moving across DriveMeGo.
              </p>
            </div>

            <ul className="adm-login-brand-points">
              {ADMIN_TRUST.map((item) => (
                <li key={item.title} className="adm-login-brand-point">
                  <span className="adm-login-brand-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="adm-login-brand-point-text">
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="adm-login-brand-secure">
              <span className="adm-login-brand-secure-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span className="adm-login-brand-secure-text">
                <strong>Restricted access</strong>
                <span>Authorized personnel only</span>
              </span>
            </div>
          </aside>

          {/* Form panel */}
          <section className="adm-login-panel">
            <div className="adm-login-card">
              <div className="adm-login-header">
                <span className="adm-login-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <span className="adm-login-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secure Portal
                </span>
                <h1 className="adm-login-title">Admin Portal</h1>
                <p className="adm-login-subtitle">
                  Sign in with your administrator credentials to continue.
                </p>
              </div>

              {error && <div className="adm-login-error-message">{error}</div>}

              <form onSubmit={handleSubmit} className="adm-login-form">
                <div className="adm-login-form-group">
                  <label htmlFor="email" className="adm-login-form-label">
                    Administrator Email
                  </label>
                  <div className="adm-login-input-wrapper">
                    <svg className="adm-login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 6L2 7" />
                    </svg>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="adm-login-form-input"
                      placeholder="admin@driveme.com"
                      required
                    />
                  </div>
                </div>

                <div className="adm-login-form-group">
                  <label htmlFor="password" className="adm-login-form-label">
                    Secure Password
                  </label>
                  <div className="adm-login-input-wrapper">
                    <svg className="adm-login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="adm-login-form-input adm-login-password-input"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      className="adm-login-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="adm-login-submit-btn"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Authenticate"}
                </button>

                <p className="adm-login-secure-note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secured with 256-bit encryption
                </p>
              </form>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminLoginPage;
