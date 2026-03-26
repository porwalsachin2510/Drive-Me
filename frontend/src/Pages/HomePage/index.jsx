"use client";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUserRole } from "../../Redux/selectors/authSelectors";

import CommuterHomePage from "../CommuterPages/CommuterHomePage/CommuteHomePage";
import Footer from "../../Components/Footer/Footer";
import Navbar from "../../Components/Navbar/Navbar";
import B2B_PartnerProfilePage from "../B2B_PartnerPages/B2B_PartnerProfilePage/B2B_PartnerProfilePage";
import B2C_PartnerProfilePage from "../B2C_PartnerPages/B2C_PartnerProfilePage/B2C_PartnerProfilePage";
import AdminDashboardPage from "../AdminPages/AdminDashboardPage/AdminDashboardPage";
import CorporateDriverDashboard from "../DriverPages/CorporateDriverDashboard/CorporateDriverDashboard";
import B2BPartnerDriverDashboard from "../DriverPages/B2BPartnerDriverDashboard/B2BPartnerDriverDashboard";
import B2CPartnerDriverDashboard from "../DriverPages/B2CPartnerDriverDashboard/B2CPartnerDriverDashboard";
import EmployeeTripBooking from "../../Components/Corporate/EmployeeTripBooking/EmployeeTripBooking";

export default function HomePage() {
  const userRole = useSelector(selectUserRole);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  // Update localStorage when activeTab changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  // Render based on user role - logged in users see their dashboards
  const renderContent = () => {
    // For logged in users with specific roles, show their dashboards
    if (userRole === "B2B_PARTNER") return <B2B_PartnerProfilePage />;
    if (userRole === "B2C_PARTNER") return <B2C_PartnerProfilePage />;
    if (userRole === "CORPORATE_DRIVER") return <CorporateDriverDashboard />;
    if (userRole === "B2B_PARTNER_DRIVER") return <B2BPartnerDriverDashboard />;
    if (userRole === "B2C_PARTNER_DRIVER") return <B2CPartnerDriverDashboard />;
    if (userRole === "CORPORATE_EMPLOYEE") return <EmployeeTripBooking />;
    if (userRole === "ADMIN") return <AdminDashboardPage />;

    // For COMMUTER, CORPORATE, or guests - show CommuterHomePage
    // CORPORATE users click "Corporate" button in navbar to go to /service-selection
    return <CommuterHomePage />;
  };

  return (
    <>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderContent()}
      <Footer />
    </>
  );
}
