import React, { useState } from "react";
import {
  FiTrendingUp,
  FiUsers,
  FiTarget,
  FiFlag,
  FiPercent,
  FiCreditCard,
  FiBarChart2,
  FiDollarSign,
  FiFileText,
} from "react-icons/fi";
import DGEmployees from "./DGEmployees";
import DGLeads from "./DGLeads";
import DGCampaigns from "./DGCampaigns";
import DGCommissions from "./DGCommissions";
import DGExpenses from "./DGExpenses";
import DGPerformance from "./DGPerformance";
import DGFinancial from "./DGFinancial";
import DGReports from "./DGReports";
import "./DemandGeneration.css";

const SECTIONS = [
  { id: "leads", label: "Lead Management", icon: <FiTarget /> },
  { id: "employees", label: "Workforce", icon: <FiUsers /> },
  { id: "campaigns", label: "Campaigns", icon: <FiFlag /> },
  { id: "commissions", label: "Commissions", icon: <FiPercent /> },
  { id: "expenses", label: "Expenses", icon: <FiCreditCard /> },
  { id: "performance", label: "Performance", icon: <FiBarChart2 /> },
  { id: "financial", label: "Financial", icon: <FiDollarSign /> },
  { id: "reports", label: "Reports", icon: <FiFileText /> },
];

const DemandGeneration = () => {
  const [section, setSection] = useState("leads");

  const renderSection = () => {
    switch (section) {
      case "leads":
        return <DGLeads />;
      case "employees":
        return <DGEmployees />;
      case "campaigns":
        return <DGCampaigns />;
      case "commissions":
        return <DGCommissions />;
      case "expenses":
        return <DGExpenses />;
      case "performance":
        return <DGPerformance />;
      case "financial":
        return <DGFinancial />;
      case "reports":
        return <DGReports />;
      default:
        return <DGLeads />;
    }
  };

  return (
    <div className="dg-root">
      <div className="dg-header">
        <div>
          <h1>
            <FiTrendingUp /> Demand Generation
          </h1>
          <p>
            Customer &amp; partner acquisition, workforce, commissions, expenses
            and analytics.
          </p>
        </div>
      </div>

      <div className="dg-subnav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={section === s.id ? "active" : ""}
            onClick={() => setSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {renderSection()}
    </div>
  );
};

export default DemandGeneration;
