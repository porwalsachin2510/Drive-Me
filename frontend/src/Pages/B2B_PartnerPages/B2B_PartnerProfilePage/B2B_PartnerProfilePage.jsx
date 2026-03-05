"use client";

import { useState } from "react";

import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import "./b2b_partnerprofilepage.css";
import B2B_Navigation from "../../../Components/B2B_Partner/B2B_Navigation/B2B_Navigation";

import B2B_Header from "../../../Components/B2B_Partner/B2B_Header/B2B_Header";
import B2B_Overview from "../../../Components/B2B_Partner/B2B_Overview/B2B_Overview";
import B2B_FleetAndDrivers from "../../../Components/B2B_Partner/B2B_FleetAndDrivers/B2B_FleetAndDrivers";
import B2B_Contracts from "../../../Components/B2B_Partner/B2B_Contracts/B2B_Contracts";
import B2B_Quotation from "../../../Components/B2B_Partner/B2B_Quotation/B2B_Quotation";
import B2B_Analytics from "../../../Components/B2B_Partner/B2B_Analytics/B2B_Analytics";
import B2B_Settings from "../../../Components/B2B_Partner/B2B_Settings/B2B_Settings";
import B2B_PartnerContractPage from "../B2B_ParnterContractPage/B2B_PartnerContractPage";
import RequirementsView from "../../../Components/B2B_Partner/RequirementsView/RequirementsView";
import B2B_Invoices from "../../../Components/B2B_Partner/B2B_Invoices/B2B_Invoices";


function B2B_PartnerProfilePage() {
  
  const [b2bactiveTab, setB2BActiveTab] = useState("overview");
  // const [activeTab, setActiveTab] = useState("corporate");

  const renderContent = () => {
    switch (b2bactiveTab) {
      case "overview":
        return <B2B_Overview />;
      case "fleet":
        return <B2B_FleetAndDrivers />;
      case "contracts":
        // return <B2B_Contracts />;
        return <B2B_PartnerContractPage />;
      case "My Quotation":
        return <B2B_Quotation />;

      case "requirements":
        return <RequirementsView />;

      case "analytics":
        return <B2B_Analytics />;
      case "invoices":
        return <B2B_Invoices />;
      case "settings":
        return <B2B_Settings />;
      default:
        return <B2B_Overview />;
    }
  };

  return (
    <div className="b2b-my-profile">
      {/* <Navbar activeTab={activeTab} setActiveTab={setActiveTab} /> */}

      <div className="b2b-fleet-dashboard-container">
        <div className="b2b-dashboard">
          <B2B_Header />
          <B2B_Navigation
            b2bactiveTab={b2bactiveTab}
            setB2BActiveTab={setB2BActiveTab}
          />

          <main className="b2b-dashboard-content">{renderContent()}</main>
        </div>
      </div>

    </div>
  );
}

export default B2B_PartnerProfilePage;
