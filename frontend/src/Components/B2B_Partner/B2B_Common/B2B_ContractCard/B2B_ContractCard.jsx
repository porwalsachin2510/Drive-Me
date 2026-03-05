import "./b2b_contractcard.css";

function B2B_ContractCard({ contract }) {
  const getStatusColor = (status) => {
    if (status === "ACTIVE") return "active";
    if (status === "COMPLETED") return "completed";
    if (status === "PENDING") return "pending";
    return "cancelled";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return "N/A";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  return (
    <div className="contract-card">
      <div className="contract-top">
        <div>
          <h4 className="contract-title">{contract.corporateOwnerId?.companyName || 'Unknown Company'}</h4>
          <p className="contract-org">{contract.corporateOwnerId?.email || 'N/A'}</p>
        </div>
        <span className={`status ${getStatusColor(contract.status)}`}>{contract.status?.toLowerCase() || 'unknown'}</span>
      </div>

      <div className="contract-details">
        <div>
          <span className="detail-label">CONTRACT VALUE</span>
          <span className="detail-text">{contract.financials?.totalAmount || contract.quotationId?.quotedPrice || 0} KWD</span>
        </div>
        <div>
          <span className="detail-label">DURATION</span>
          <span className="detail-text">📅 {calculateDuration(contract.startDate, contract.endDate)}</span>
        </div>
        <div>
          <span className="detail-label">REQUIREMENTS</span>
          <span className="detail-text">{contract.requirements?.vehicleType || contract.serviceType || 'N/A'}</span>
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
