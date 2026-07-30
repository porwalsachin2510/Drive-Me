"use client";

import { useState } from "react";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
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
import AdminWalletManagement from "../../../Components/Admin/AdminWalletManagement/AdminWalletManagement";
import AdminDropdownManagement from "../../../Components/Admin/AdminDropdownManagement/AdminDropdownManagement";
import AdminManagement from "../../../Components/Admin/AdminManagement/AdminManagement";
import AdminCommissionSettings from "../../../Components/Admin/AdminCommissionSettings/AdminCommissionSettings";
import AdminCancellationSettings from "../../../Components/Admin/AdminCancellationSettings/AdminCancellationSettings";
import AdminNegotiations from "../../../Components/Admin/AdminNegotiations/AdminNegotiations";
import AdminTermsManagement from "../../../Components/Admin/AdminTermsManagement/AdminTermsManagement";
import AdminCashRenewals from "../../../Components/Admin/AdminCashRenewals/AdminCashRenewals";
import ExpansionManagement from "../ExpansionManagement/ExpansionManagement";
import DemandGeneration from "../../../Components/Admin/DemandGeneration";
import AdminAccount from "../../../Components/Admin/AdminAccount/AdminAccount";
import "./admindashboardpage.css";

function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const renderContent = () => {
    switch (activeTab) {
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
      case "cash-renewals":
        return <AdminCashRenewals />;
      case "vehicle-approval":
        return <AdminVehicleApproval />;
      case "settlement":
        return <AdminSettlement />;
      case "content":
        return <AdminContent />;
      case "wallets":
        return <AdminWalletManagement />;
      case "dropdowns":
        return <AdminDropdownManagement />;
      case "admin-management":
        return <AdminManagement />;
      case "commission-settings":
        return <AdminCommissionSettings />;
      case "cancellation-settings":
        return <AdminCancellationSettings />;
      case "negotiations":
        return <AdminNegotiations />;
      case "terms-management":
        return <AdminTermsManagement />;
      case "expansion-management":
        return <ExpansionManagement />;
      case "demand-generation":
        return <DemandGeneration />;
      case "account":
        return <AdminAccount />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="admin-dashboard-content">{renderContent()}</div>
    </DashboardLayout>
  );
}

export default AdminDashboardPage;
