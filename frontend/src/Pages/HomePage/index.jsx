"use client";
import { useState } from "react";
import { useSelector } from "react-redux";
import { selectUserRole } from "../../Redux/selectors/authSelectors";

import ServiceSelection from "../CorporatePages/ServiceSelection/ServiceSelection";
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
  const [activeTab, setActiveTab] = useState("commuters");

  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* CORPORATE USER */}
      {userRole === "CORPORATE" && <ServiceSelection />}

      {/* COMMUTER / GUEST (unauthenticated users see the search page too) */}
      {(userRole === "COMMUTER" || !userRole) && <CommuterHomePage />}

      {/* B2B_PARTNER */}
      {userRole === "B2B_PARTNER" && <B2B_PartnerProfilePage />}

      {/* B2C_PARTNER */}
      {userRole === "B2C_PARTNER" && <B2C_PartnerProfilePage />}

      {/* CORPORATE_DRIVER */}
      {userRole === "CORPORATE_DRIVER" && <CorporateDriverDashboard />}

      {/* B2B_PARTNER_DRIVER*/}
      {userRole === "B2B_PARTNER_DRIVER" && <B2BPartnerDriverDashboard />}

      {/* B2C_PARTNER_DRIVER */}
      {userRole === "B2C_PARTNER_DRIVER" && <B2CPartnerDriverDashboard />}

      {/* CORPORATE_EMPLOYEE */}
      {userRole === "CORPORATE_EMPLOYEE" && <EmployeeTripBooking />}

      {/* ADMIN */}
      {userRole === "ADMIN" && <AdminDashboardPage />}

      <Footer />
    </>
  );
}
