import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();

  // Get initial tab from URL query params
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("tab") || "my-rides";
  };

  const [profileactiveTab, setProfileActiveTab] = useState(getInitialTab);
  const [activeTab, setActiveTab] = useState("corporate");

  // When URL changes (e.g., back navigation), update the tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setProfileActiveTab(tabFromUrl);
      // Clear the URL param after reading it
      navigate("/commuter-profile", { replace: true });
    }
  }, [location.search, navigate]);

  // Custom handler to clear URL when user manually clicks a tab
  const handleTabChange = (tab) => {
    setProfileActiveTab(tab);
    // Clear any tab param from URL when manually switching tabs
    if (location.search.includes("tab=")) {
      navigate("/commuter-profile", { replace: true });
    }
  };

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
            setProfileActiveTab={handleTabChange}
          />
          <div className="commuter-profile-page-content">{renderContent()}</div>
        </div>
      </div>

      <Footer />
    </div>
  );
}



