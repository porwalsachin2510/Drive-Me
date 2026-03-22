"use client";

import { useState } from "react";
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
import AdminContent from "../../../Components/Admin/AdminContent/AdminContent";
import "./admindashboardpage.css";

function AdminDashboardPage() {
  
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
    case "content":
      return <AdminContent />;
    default:
      return <AdminOverview />;
  }
  };
  
  
    
  return (
    <div className="ad-dash-profile">
      <div className="ad-dash-dashboard">
        <AdminHeader />
        <AdminNavigation
          dashboardactiveTab={dashboardactiveTab}
          setDashboardActiveTab={setDashboardActiveTab}
        />
        <div className="ad-dash-content">{renderContent()}</div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
