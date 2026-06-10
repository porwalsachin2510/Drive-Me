"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import CompanyProfile from "../../../Components/Corporate/Company_Profile/CompanyProfile";
import AccountSettings from "../../../Components/Corporate/Account_Settings/AccountSettings";
import CorporateEmployeeManagement from "../../../Components/Corporate/CorporateEmployeeManagement/CorporateEmployeeManagement";
import RequirementManagement from "../../../Components/Corporate/RequirementManagement/RequirementManagement";
import CorporateContractPage from "../CorporateContractPage/CorporateContractPage";
import CorporateEmployeeBookingsPage from "../CorporateEmployeeBookingsPage/CorporateEmployeeBookingsPage";
import CorporateBilling from "../../../Components/Corporate/CorporateBilling/CorporateBilling";
import CorporateRoutesTab from "../../../Components/Corporate/CorporateRoutesTab/CorporateRoutesTab";
import MyQuotationsContent from "../MyQuotations/MyQuotationsContent";
import MyCommission from "../../../Components/MyCommission/MyCommission";
import "./corporateprofilepage.css";

export default function CorporateProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get initial tab from URL query params on mount
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("tab") || "company-profile";
  };

  const [corporateactiveTab, setCorporateActiveTab] = useState(getInitialTab);
  const [corporateStats, setCorporateStats] = useState({
    activeContracts: 0,
    totalEmployees: 0,
    activeRoutes: 0,
    monthlyBookings: 0,
  });

  // When URL changes (e.g., back navigation), update the tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== corporateactiveTab) {
      setCorporateActiveTab(tabFromUrl);
      navigate("/corporate-profile", { replace: true });
    }
  }, [location.search, corporateactiveTab, navigate]);

  // Custom handler to clear URL when user manually clicks a tab
  const handleTabChange = (tab) => {
    setCorporateActiveTab(tab);
    if (location.search.includes("tab=")) {
      navigate("/corporate-profile", { replace: true });
    }
  };

  // Fetch corporate stats from backend
  useEffect(() => {
    const fetchCorporateStats = async () => {
      try {
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
      }
    };

    fetchCorporateStats();
  }, []);

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
      case "routes":
        return <CorporateRoutesTab />;
      case "billing":
        return <CorporateBilling />;
      case "my-commission":
        return <MyCommission />;
      case "account-settings":
        return <AccountSettings />;
      default:
        return <CompanyProfile />;
    }
  };

  // Stats Component to pass to DashboardLayout
  const StatsComponent = () => (
    <div className="corporate-stats-grid">
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
  );

  return (
    <DashboardLayout
      activeTab={corporateactiveTab}
      setActiveTab={handleTabChange}
      showStats={true}
      statsComponent={<StatsComponent />}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
