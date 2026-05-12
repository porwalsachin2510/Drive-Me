import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import FindRoutes from "../../../Components/Section/FindRoutes/FindRoutes";
import Wallet from "../../../Components/Section/Wallet/Wallet";
import Alerts from "../../../Components/Section/Alerts/Alerts";
import Settings from "../../../Components/Section/Settings/Settings";
import TravelHistory from "../../../Components/TravelHistory/TravelHistory";
import SubscriptionSettings from "../../../Components/SubscriptionSettings/SubscriptionSettings";
import CommuterMyBookingsPage from "../CommuterMyBookingsPage/CommuterMyBookingsPage";
import CommuterRouteRequests from "../../../Components/CommuterRouteRequests/CommuterRouteRequests";
import "./commuterprofilepage.css";

export default function CommuterProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get initial tab from URL query params
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("tab") || "my-rides";
  };

  const [profileactiveTab, setProfileActiveTab] = useState(getInitialTab);

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
      case "route-requests":
        return <CommuterRouteRequests />;
      case "settings":
        return <Settings />;
      default:
        return <CommuterMyBookingsPage />;
    }
  };

  return (
    <DashboardLayout
      activeTab={profileactiveTab}
      setActiveTab={handleTabChange}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
