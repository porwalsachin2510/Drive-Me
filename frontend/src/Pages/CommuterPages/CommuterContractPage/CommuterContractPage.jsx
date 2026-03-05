import { useState } from "react";
import Navbar from "../../../Components/Navbar/Navbar";
import "./commutercontractpage.css";
import Footer from "../../../Components/Footer/Footer";
import ContractManagement from "../../../Components/ContractManagement/ContractManagement";

export default function CommuterContractPage() {
  const [activeTab, setActiveTab] = useState("commuters");
  

    return (
      <div className="homepage">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        <ContractManagement/>

        <Footer />
      </div>
    );

}
