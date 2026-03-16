import "./b2b_contractcard.css";

function B2B_ContractCard({ contract }) {
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "active" || statusLower === "approved") return "active";
    if (statusLower === "completed") return "completed";
    if (statusLower === "pending") return "pending";
    return "cancelled";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const calculateDuration = (startDate, endDate) => {
    if (!startDate && !endDate) {
      // Try to get duration from rentalPeriod
      if (contract.rentalPeriod?.startDate && contract.rentalPeriod?.endDate) {
        const start = new Date(contract.rentalPeriod.startDate);
        const end = new Date(contract.rentalPeriod.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return `${days} days`;
      }
      // Try to calculate from contract dates
      if (contract.contractPeriod?.startDate && contract.contractPeriod?.endDate) {
        const start = new Date(contract.contractPeriod.startDate);
        const end = new Date(contract.contractPeriod.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return `${days} days`;
      }
      return "Ongoing";
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Ongoing";
    if (days > 365) {
      const years = Math.floor(days / 365);
      const remainingMonths = Math.floor((days % 365) / 30);
      return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years} year${years > 1 ? 's' : ''}`;
    }
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    return `${days} days`;
  };

  const getRequirements = () => {
    // Try different sources for requirements
    if (contract.vehicles && Array.isArray(contract.vehicles) && contract.vehicles.length > 0) {
      const totalVehicles = contract.vehicles.reduce((sum, v) => sum + (v.quantity || 1), 0);
      const vehicleTypes = [...new Set(contract.vehicles.map(v => v.vehicleType || v.category || 'Vehicle'))];
      return `${totalVehicles} x ${vehicleTypes.join(', ')}`;
    }
    if (contract.requirements?.vehicleType) {
      const qty = contract.requirements?.quantity || 1;
      return `${qty} x ${contract.requirements.vehicleType}`;
    }
    if (contract.serviceType) {
      return contract.serviceType;
    }
    if (contract.quotationId?.requirements) {
      return contract.quotationId.requirements;
    }
    return "Fleet Services";
  };

  const getContractValue = () => {
    return contract.financials?.totalAmount || 
           contract.totalAmount || 
           contract.quotationId?.quotedPrice || 
           contract.amount || 
           0;
  };

  return (
    <div className="contract-card">
      <div className="contract-top">
        <div>
          <h4 className="contract-title">{contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Client'}</h4>
          <p className="contract-org">{contract.contractNumber || contract.corporateOwnerId?.email || ''}</p>
        </div>
        <span className={`status ${getStatusColor(contract.status)}`}>{contract.status?.toLowerCase() || 'pending'}</span>
      </div>

      <div className="contract-details">
        <div>
          <span className="detail-label">CONTRACT VALUE</span>
          <span className="detail-text">{getContractValue().toLocaleString()} KWD</span>
        </div>
        <div>
          <span className="detail-label">DURATION</span>
          <span className="detail-text">{calculateDuration(contract.startDate, contract.endDate)}</span>
        </div>
        <div>
          <span className="detail-label">REQUIREMENTS</span>
          <span className="detail-text">{getRequirements()}</span>
        </div>
      </div>

      <div className="contract-bottom">
        <div className="payment">
          <span className={`dot ${contract.paymentStatus === "PAID" ? "paid" : ""}`}></span>
          <span>Payment: {contract.paymentStatus || 'Pending'}</span>
        </div>
        <button className="manage-link">Manage Contract</button>
      </div>
    </div>
  );
}

export default B2B_ContractCard;
