"use client";

import { useState } from "react";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import MyTrips from "../../../Components/B2C_Partner/Tabs/MyTrips/MyTrips";
import Earnings from "../../../Components/B2C_Partner/Tabs/Earnings/Earnings";
import B2C_FleetAndDrivers from "../../../Components/B2C_Partner/B2C_FleetAndDrivers/B2C_FleetAndDrivers";
import B2C_Routes from "../../../Components/B2C_Partner/B2C_Routes/B2C_Routes";
import B2CPartnerDailyTrips from "../../../Components/B2C_Partner/B2CPartnerDailyTrips/B2CPartnerDailyTrips";
import Account from "../../../Components/B2C_Partner/Tabs/Account/Account";
import B2CPartnerOverview from "../../../Components/B2C_Partner/B2CPartnerOverview/B2CPartnerOverview";
import B2CRouteRequests from "../../../Components/B2C_Partner/B2CRouteRequests/B2CRouteRequests";
import "./b2c_partnerprofilepage.css";

function B2C_PartnerProfilePage() {
  const [b2cactiveTab, setB2CActiveTab] = useState("overview");

  const renderContent = () => {
    switch (b2cactiveTab) {
      case "overview":
        return <B2CPartnerOverview />;
      case "trips":
        return <MyTrips />;
      case "daily-trips":
        return <B2CPartnerDailyTrips />;
      case "earnings":
        return <Earnings />;
      case "vehicles":
        return <B2C_FleetAndDrivers />;
      case "routes":
        return <B2C_Routes />;
      case "route-requests":
        return <B2CRouteRequests />;
      case "account":
        return <Account />;
      default:
        return <B2CPartnerOverview />;
    }
  };

  return (
    <DashboardLayout activeTab={b2cactiveTab} setActiveTab={setB2CActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default B2C_PartnerProfilePage;
