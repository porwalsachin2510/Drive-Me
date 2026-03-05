import { useState } from "react";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import ContractManagement from "../../../Components/ContractManagement/ContractManagement";

export default function B2C_PartnerContractPage() {
  const [activeTab, setActiveTab] = useState("commuters");

  return (
    <div className="homepage">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <ContractManagement />

      <Footer />
    </div>
  );
}
