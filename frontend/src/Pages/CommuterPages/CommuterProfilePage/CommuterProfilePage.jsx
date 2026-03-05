import { useState } from "react";
import Navbar from "../../../Components/Navbar/Navbar";
import Sidebar from "../../../Components/Section/Sidebar/Sidebar";
import Navigation from "../../../Components/Section/Navigation/Navigation";
import FindRoutes from "../../../Components/Section/FindRoutes/FindRoutes";
import Wallet from "../../../Components/Section/Wallet/Wallet";
import Alerts from "../../../Components/Section/Alerts/Alerts";
import Settings from "../../../Components/Section/Settings/Settings";
import TravelHistory from "../../../Components/TravelHistory/TravelHistory";
import SubscriptionSettings from "../../../Components/SubscriptionSettings/SubscriptionSettings";
import "./commuterprofilepage.css";
import Footer from "../../../Components/Footer/Footer";
import CommuterMyBookingsPage from "../CommuterMyBookingsPage/CommuterMyBookingsPage";

export default function CommuterProfilePage() {
  const [profileactiveTab, setProfileActiveTab] = useState("my-rides");
  const [activeTab, setActiveTab] = useState("corporate");

  const renderContent = () => {
    switch (profileactiveTab) {
      case "my-rides":
      return <CommuterMyBookingsPage />;
      case "find-routes":
        return <FindRoutes />;
      case "wallet":
        return <Wallet />;
      case "alerts":
        return <Alerts />;
      case "travel-history":
        return <TravelHistory />;
      case "subscription-settings":
        return <SubscriptionSettings />;
      case "settings":
        return <Settings />;
      default:
      return <CommuterMyBookingsPage />;
    }
  };

  return (
    <div className="commuter-profile-page-commuter-my-profile">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="commuter-profile-page-container">
        <Sidebar />
        <div className="commuter-profile-page-main">
          <Navigation
            profileactiveTab={profileactiveTab}
            setProfileActiveTab={setProfileActiveTab}
          />
          <div className="commuter-profile-page-content">{renderContent()}</div>
        </div>
      </div>

      <Footer />
    </div>
  );
}



