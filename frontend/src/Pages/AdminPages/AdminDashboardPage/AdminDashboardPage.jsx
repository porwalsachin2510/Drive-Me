"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
// import Navbar from "../../../Components/Navbar/Navbar";
// import Footer from "../../../Components/Footer/Footer";
import AdminHeader from "../../../Components/Admin/AdminHeader/AdminHeader";
import AdminNavigation from "../../../Components/Admin/AdminNavigation/AdminNavigation";
import AdminOverview from "../../../Components/Admin/AdminOverview/AdminOverview";
import AdminB2CManagement from "../../../Components/Admin/AdminB2CManagement/AdminB2CManagement";
import AdminRidePooling from "../../../Components/Admin/AdminRidePooling/AdminRidePooling";
import AdminB2BListings from "../../../Components/Admin/AdminB2BListings/AdminB2BListings";
import AdminUsers from "../../../Components/Admin/AdminUsers/AdminUsers";
import AdminReports from "../../../Components/Admin/AdminReports/AdminReports";
import AdminFinance from "../../../Components/Admin/AdminFinance/AdminFinance";
import AdminComm from "../../../Components/Admin/AdminComm/AdminComm";
import AdminAds from "../../../Components/Admin/AdminAds/AdminAds";
import PaymentVerification from "../AdminPaymentVerification/PaymentVerification";
import AdminVehicleApproval from "../../../Components/Admin/AdminVehicleApproval/AdminVehicleApproval";
import AdminSettlement from "../../../Components/Admin/AdminSettlement/AdminSettlement";
import api from "../../../utils/api";
import "./admindashboardpage.css";

function AdminDashboardPage() {

    const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // const [activeTab, setActiveTab] = useState("corporate");
  const [dashboardactiveTab, setDashboardActiveTab] = useState("overview");
  console.log(dashboardactiveTab);

const renderContent = () => {
  switch (dashboardactiveTab) {
    case "overview":
      return <AdminOverview />;
    case "b2c":
      return <AdminB2CManagement />;
    case "ride-pooling":
      return <AdminRidePooling />;
    case "b2b":
      return <AdminB2BListings />;
    case "users":
      return <AdminUsers />;
    case "reports":
      return <AdminReports />;
    case "finance":
      return <AdminFinance />;
    case "comm":
      return <AdminComm />;
    case "ads":
      return <AdminAds />;
    case "Payment Verification":
      return <PaymentVerification />;
    case "vehicle-approval":
      return <AdminVehicleApproval />;
    case "settlement":
      return <AdminSettlement />;
    default:
      return <AdminOverview />;
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
      navigate("/admin-login");
    } catch (err) {
      console.error("Logout error:", err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login regardless of error
      navigate("/admin-login");
    }
  };
    
  return (
    <div className="ad-dash-profile">
      {/* <Navbar activeTab={activeTab} setActiveTab={setActiveTab} /> */}

      <div className="ad-dash-dashboard">
        <button className="b2b-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
        <AdminHeader />
        <AdminNavigation
          dashboardactiveTab={dashboardactiveTab}
          setDashboardActiveTab={setDashboardActiveTab}
        />
        <div className="ad-dash-content">{renderContent()}</div>
      </div>

      {/* <Footer /> */}
    </div>
  );
}

export default AdminDashboardPage;
