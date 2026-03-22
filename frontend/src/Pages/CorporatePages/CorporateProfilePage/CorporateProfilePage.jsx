import { useState, useEffect } from "react";
import { useNavigate, useLocation  } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import api from "../../../utils/api";

import Navbar from "../../../Components/Navbar/Navbar";
import CompanyProfile from "../../../Components/Corporate/Company_Profile/CompanyProfile";
import AccountSettings from "../../../Components/Corporate/Account_Settings/AccountSettings";
import CorporateEmployeeManagement from "../../../Components/Corporate/CorporateEmployeeManagement/CorporateEmployeeManagement";
import RequirementManagement from "../../../Components/Corporate/RequirementManagement/RequirementManagement";
import CorporateContractPage from "../CorporateContractPage/CorporateContractPage";
import CorporateEmployeeBookingsPage from "../CorporateEmployeeBookingsPage/CorporateEmployeeBookingsPage";
import CorporateBilling from "../../../Components/Corporate/CorporateBilling/CorporateBilling";
import MyQuotationsContent from "../MyQuotations/MyQuotationsContent";
import Footer from "../../../Components/Footer/Footer";
import "./corporateprofilepage.css";


export default function CorporateProfilePage() {
const navigate = useNavigate();
const location = useLocation();
const dispatch = useDispatch();

const [activeTab, setActiveTab] = useState("corporate");

// Get initial tab from URL query params on mount
const getInitialTab = () => {
  const searchParams = new URLSearchParams(location.search);
  return searchParams.get("tab") || "company-profile";
};

const [corporateactiveTab, setCorporateActiveTab] = useState(getInitialTab);

// When URL changes (e.g., back navigation), update the tab
useEffect(() => {
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get("tab");
  if (tabFromUrl && tabFromUrl !== corporateactiveTab) {
    setCorporateActiveTab(tabFromUrl);
    // Clear the URL param after reading it
    navigate("/corporate-profile", { replace: true });
  }
}, [location.search]);

// Custom handler to clear URL when user manually clicks a tab
const handleTabChange = (tab) => {
  setCorporateActiveTab(tab);
  // Clear any tab param from URL when manually switching tabs
  if (location.search.includes("tab=")) {
    navigate("/corporate-profile", { replace: true });
  }
};
  
  // Add state for real corporate stats
  const [corporateStats, setCorporateStats] = useState({
    activeContracts: 0,
    totalEmployees: 0,
    activeRoutes: 0,
    monthlyBookings: 0,
  });
  // eslint-disable-next-line no-unused-vars
  const [statsLoading, setStatsLoading] = useState(true);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch corporate stats from backend
  useEffect(() => {
    const fetchCorporateStats = async () => {
      try {
        setStatsLoading(true);
        const response = await api.get("/corporate/stats");
        if (response.data.success) {
          setCorporateStats({
            activeContracts: response.data.data?.activeContracts || 0,
            totalEmployees: response.data.data?.totalEmployees || 0,
            activeRoutes: response.data.data?.activeRoutes || 0,
            monthlyBookings: response.data.data?.monthlyBookings || 0,
          });
        }
      } catch (error) {
        console.error("Error fetching corporate stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchCorporateStats();
  }, []);

  const fetchFeedbackSummary = async () => {
    try {
      setFeedbackLoading(true);
      const response = await api.get("/corporate-employees/feedback-summary");
      if (response.data.success) {
        setFeedbackSummary(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching feedback summary:", error);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleToggleFeedback = () => {
    if (!showFeedback && !feedbackSummary) {
      fetchFeedbackSummary();
    }
    setShowFeedback(!showFeedback);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          style={{
            color: i <= Math.round(rating) ? "#f59e0b" : "#d1d5db",
            fontSize: "16px",
          }}
        >
          {"\u2605"}
        </span>,
      );
    }
    return stars;
  };

  const renderContent = () => {
    switch (corporateactiveTab) {
      case "company-profile":
        return <CompanyProfile />;
      case "my-quotations":
        return <MyQuotationsContent />;
      case "contracts":
        return <CorporateContractPage />;
      case "employee-management":
        return <CorporateEmployeeManagement />;
      case "employee-bookings":
        return <CorporateEmployeeBookingsPage />;
      case "requirement-management":
        return <RequirementManagement />;
      case "billing":
        return <CorporateBilling />;
      case "account-settings":
        return <AccountSettings />;
      default:
        return <CompanyProfile />;
    }
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

  return (
    <div className="corporate-my-profile">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="corporate-dashboard-container">
        {/* Stats Cards */}
        <div className="corporate-stats-section">
          <div className="corporate-stat-card">
            <div className="corporate-stat-icon corporate-blue-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className="corporate-stat-content">
              <div className="corporate-stat-label">Active Contracts</div>
              <div className="corporate-stat-value">
                {corporateStats.activeContracts}
              </div>
            </div>
          </div>

          <div className="corporate-stat-card">
            <div className="corporate-stat-icon corporate-green-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="corporate-stat-content">
              <div className="corporate-stat-label">Total Employees</div>
              <div className="corporate-stat-value">
                {corporateStats.totalEmployees}
              </div>
            </div>
          </div>

          <div className="corporate-stat-card">
            <div className="corporate-stat-icon corporate-purple-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="20" x2="12" y2="10"></line>
                <line x1="18" y1="20" x2="18" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="16"></line>
              </svg>
            </div>
            <div className="corporate-stat-content">
              <div className="corporate-stat-label">Active Routes</div>
              <div className="corporate-stat-value">
                {corporateStats.activeRoutes}
              </div>
            </div>
          </div>
        </div>

        {/* Employee Feedback Summary */}
        <div style={{ margin: "0 0 24px 0" }}>
          <button
            onClick={handleToggleFeedback}
            style={{
              background: showFeedback
                ? "#e8eaf6"
                : "linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)",
              color: showFeedback ? "#1a237e" : "#fff",
              border: showFeedback ? "1px solid #c5cae9" : "none",
              padding: "10px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              width: "100%",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Employee Feedback Summary</span>
            <span style={{ fontSize: "12px" }}>
              {showFeedback ? "Hide" : "View"}
            </span>
          </button>

          {showFeedback && (
            <div
              style={{
                background: "#fff",
                borderRadius: "0 0 8px 8px",
                border: "1px solid #e0e0e0",
                borderTop: "none",
                padding: "20px",
              }}
            >
              {feedbackLoading ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <p>Loading feedback data...</p>
                </div>
              ) : feedbackSummary ? (
                <>
                  {/* Summary Stats */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      marginBottom: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex: "1",
                        minWidth: "120px",
                        background: "#e8f5e9",
                        borderRadius: "8px",
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: "700",
                          color: "#2e7d32",
                        }}
                      >
                        {feedbackSummary.averageRating || 0}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#388e3c",
                          fontWeight: "500",
                        }}
                      >
                        Avg Rating
                      </div>
                      <div>
                        {renderStars(feedbackSummary.averageRating || 0)}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "1",
                        minWidth: "120px",
                        background: "#e3f2fd",
                        borderRadius: "8px",
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: "700",
                          color: "#1565c0",
                        }}
                      >
                        {feedbackSummary.totalFeedbacks || 0}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#1976d2",
                          fontWeight: "500",
                        }}
                      >
                        Total Feedbacks
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "1",
                        minWidth: "120px",
                        background: "#f3e5f5",
                        borderRadius: "8px",
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: "700",
                          color: "#6a1b9a",
                        }}
                      >
                        {feedbackSummary.totalEmployees || 0}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#7b1fa2",
                          fontWeight: "500",
                        }}
                      >
                        Total Employees
                      </div>
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  {feedbackSummary.ratingDistribution && (
                    <div style={{ marginBottom: "20px" }}>
                      <h4
                        style={{
                          margin: "0 0 12px 0",
                          fontSize: "14px",
                          color: "#333",
                        }}
                      >
                        Rating Distribution
                      </h4>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count =
                          feedbackSummary.ratingDistribution[star] || 0;
                        const total = feedbackSummary.totalFeedbacks || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div
                            key={star}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                width: "20px",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#555",
                              }}
                            >
                              {star}
                            </span>
                            <span
                              style={{ color: "#f59e0b", fontSize: "14px" }}
                            >
                              {"\u2605"}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                background: "#f0f0f0",
                                borderRadius: "4px",
                                height: "8px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  background: "#f59e0b",
                                  height: "100%",
                                  borderRadius: "4px",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                width: "40px",
                                fontSize: "12px",
                                color: "#888",
                                textAlign: "right",
                              }}
                            >
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Feedbacks */}
                  {feedbackSummary.recentFeedbacks &&
                    feedbackSummary.recentFeedbacks.length > 0 && (
                      <div>
                        <h4
                          style={{
                            margin: "0 0 12px 0",
                            fontSize: "14px",
                            color: "#333",
                          }}
                        >
                          Recent Employee Feedback
                        </h4>
                        {feedbackSummary.recentFeedbacks.map((fb, i) => (
                          <div
                            key={i}
                            style={{
                              background: "#fafafa",
                              borderRadius: "6px",
                              padding: "12px",
                              marginBottom: "8px",
                              borderLeft: "3px solid #1a237e",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "4px",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "600",
                                  fontSize: "13px",
                                  color: "#333",
                                }}
                              >
                                {fb.employeeName}
                              </span>
                              <span style={{ fontSize: "11px", color: "#999" }}>
                                {fb.date
                                  ? new Date(fb.date).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                            {fb.rating && <div>{renderStars(fb.rating)}</div>}
                            {fb.feedback && (
                              <p
                                style={{
                                  margin: "4px 0 0 0",
                                  fontSize: "13px",
                                  color: "#555",
                                  lineHeight: "1.4",
                                }}
                              >
                                {fb.feedback}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {feedbackSummary.totalFeedbacks === 0 && (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#9e9e9e",
                        padding: "20px",
                      }}
                    >
                      No employee feedback yet.
                    </p>
                  )}
                </>
              ) : (
                <p
                  style={{
                    textAlign: "center",
                    color: "#9e9e9e",
                    padding: "20px",
                  }}
                >
                  Unable to load feedback data.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="corporate-main-content">
          <div className="corporate-content-header">
            <div className="corporate-header-left">
              <h1 className="corporate-portal-title">
                Corporate Management Portal
              </h1>
              <span className="corporate-verified-badge">
                Verified Business
              </span>
            </div>
            <button className="corporate-logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>

          {/* Tabs */}
          <div className="corporate-tabs-container">
            <button
              className={`corporate-tab ${
                corporateactiveTab === "company-profile"
                  ? "corporate-active"
                  : ""
              }`}
              onClick={() => handleTabChange("company-profile")}
            >
              Company Profile
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "my-quotations" ? "corporate-active" : ""
              }`}
              onClick={() => handleTabChange("my-quotations")}
            >
              My Quotations
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "contracts" ? "corporate-active" : ""
              }`}
              onClick={() => handleTabChange("contracts")}
            >
              Contracts
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "employee-management"
                  ? "corporate-active"
                  : ""
              }`}
              onClick={() => handleTabChange("employee-management")}
            >
              Employee Management
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "employee-bookings"
                  ? "corporate-active"
                  : ""
              }`}
              onClick={() => handleTabChange("employee-bookings")}
            >
              Employee Bookings
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "requirement-management"
                  ? "corporate-active"
                  : ""
              }`}
              onClick={() => handleTabChange("requirement-management")}
            >
              Requirements
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "billing" ? "corporate-active" : ""
              }`}
              onClick={() => handleTabChange("billing")}
            >
              Billing
            </button>
            <button
              className={`corporate-tab ${
                corporateactiveTab === "account-settings"
                  ? "corporate-active"
                  : ""
              }`}
              onClick={() => handleTabChange("account-settings")}
            >
              Account Settings
            </button>
          </div>

          {/* Tab Content */}
          <div className="corporate-tab-content">{renderContent()}</div>
        </div>
      </div>
      <Footer />
    </div>
  );
}


