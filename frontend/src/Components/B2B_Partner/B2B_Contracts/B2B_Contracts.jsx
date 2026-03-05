import "./b2b_contracts.css";

function B2B_Contracts() {
  const contracts = [
    {
      id: 1,
      name: "Employee Transport - Mangaf",
      organization: "KOC",
      value: "3,246 KWD",
      duration: "4/23/2023 - 2/27/2024",
      requirements: "1 x Bus",
      status: "Active",
      payment: "Paid",
    },
    {
      id: 2,
      name: "Employee Transport - Kuwait City",
      organization: "Zain",
      value: "4,549 KWD",
      duration: "11/19/2023 - 2/26/2024",
      requirements: "1 x Bus",
      status: "Active",
      payment: "Paid",
    },
    {
      id: 3,
      name: "Employee Transport - Hawally",
      organization: "NBK",
      value: "5,288 KWD",
      duration: "4/22/2023 - 6/23/2024",
      requirements: "4 x Van",
      status: "Active",
      payment: "Paid",
    },
    {
      id: 4,
      name: "Employee Transport - Mangaf",
      organization: "Alshaya Group",
      value: "4,996 KWD",
      duration: "10/3/2023 - 6/24/2024",
      requirements: "1 x Van",
      status: "Cancelled",
      payment: "Up to Date",
    },
    {
      id: 5,
      name: "Employee Transport - Khaltan",
      organization: "KNPC",
      value: "4,903 KWD",
      duration: "3/30/2023 - 3/3/2024",
      requirements: "2 x Van",
      status: "Completed",
      payment: "Pending Invoice",
    },
  ];

  const getStatusColor = (status) => {
    if (status === "Active") return "active";
    if (status === "Completed") return "completed";
    return "cancelled";
  };

  return (
    <div className="contracts">
      <h2 className="contracts-title">B2B Contracts</h2>
      <div className="contracts-list">
        {contracts.map((contract) => (
          <div key={contract.id} className="contract-item">
            <div className="contract-icon">📄</div>

            <div className="contract-main">
              <div className="contract-header">
                <div>
                  <h3 className="contract-name">{contract.name}</h3>
                  <p className="contract-org">{contract.organization}</p>
                </div>
                <span
                  className={`contract-status ${getStatusColor(
                    contract.status
                  )}`}
                >
                  {contract.status}
                </span>
              </div>

              <div className="contract-details">
                <div className="contract-detail">
                  <span className="detail-label">CONTRACT VALUE</span>
                  <span className="detail-value">{contract.value}</span>
                </div>
                <div className="contract-detail">
                  <span className="detail-label">DURATION</span>
                  <span className="detail-value">📅 {contract.duration}</span>
                </div>
                <div className="contract-detail">
                  <span className="detail-label">REQUIREMENTS</span>
                  <span className="detail-value">{contract.requirements}</span>
                </div>
              </div>

              <div className="contract-footer">
                <div className="payment-status">
                  <span
                    className={`payment-dot ${
                      contract.payment === "Paid" ? "paid" : ""
                    }`}
                  ></span>
                  <span>Payment: {contract.payment}</span>
                </div>
                <button className="manage-btn">Manage Contract</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default B2B_Contracts;
