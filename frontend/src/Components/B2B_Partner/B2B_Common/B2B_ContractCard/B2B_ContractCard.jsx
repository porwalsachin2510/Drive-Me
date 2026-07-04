import { useNavigate } from "react-router-dom";
import { getActiveCurrency } from "../../../../config/localeConfig";
import "./b2b_contractcard.css";

function B2B_ContractCard({ contract }) {
  const navigate = useNavigate();
  const isManaged = contract.serviceMode === "MANAGED";
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "active" || statusLower === "approved") return "active";
    if (statusLower === "completed") return "completed";
    if (statusLower === "pending") return "pending";
    return "cancelled";
  };

  // eslint-disable-next-line no-unused-vars
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateDuration = (startDate, endDate) => {
    // First check if we have duration in rentalPeriod (preferred)
    if (contract.rentalPeriod?.duration) {
      const duration = contract.rentalPeriod.duration;
      const durationType = contract.rentalPeriod.durationType;
      if (durationType === "DAILY" || durationType === "days") {
        return `${duration} day${duration > 1 ? "s" : ""}`;
      } else if (durationType === "WEEKLY" || durationType === "weeks") {
        return `${duration} week${duration > 1 ? "s" : ""}`;
      } else if (durationType === "MONTHLY" || durationType === "months") {
        return `${duration} month${duration > 1 ? "s" : ""}`;
      } else if (
        durationType === "LONG_TERM" ||
        durationType === "YEARLY" ||
        durationType === "years"
      ) {
        return `${duration} year${duration > 1 ? "s" : ""}`;
      }
      return `${duration} days`;
    }

    if (!startDate && !endDate) {
      // Try to get duration from rentalPeriod dates
      if (contract.rentalPeriod?.startDate && contract.rentalPeriod?.endDate) {
        const start = new Date(contract.rentalPeriod.startDate);
        const end = new Date(contract.rentalPeriod.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return `${days} days`;
      }
      // Try to calculate from contract dates
      if (
        contract.contractPeriod?.startDate &&
        contract.contractPeriod?.endDate
      ) {
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
      return remainingMonths > 0
        ? `${years}y ${remainingMonths}mo`
        : `${years} year${years > 1 ? "s" : ""}`;
    }
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? "s" : ""}`;
    }
    return `${days} days`;
  };

  const getRequirements = () => {
    // Try different sources for requirements
    if (
      contract.vehicles &&
      Array.isArray(contract.vehicles) &&
      contract.vehicles.length > 0
    ) {
      const totalVehicles = contract.vehicles.reduce(
        (sum, v) => sum + (v.quantity || 1),
        0,
      );
      // Try to get vehicle type from assignedVehicles or vehicleId
      const vehicleType =
        contract.vehicles[0]?.vehicleId?.vehicleType ||
        contract.vehicles[0]?.vehicleType ||
        contract.vehicles[0]?.category ||
        "Vehicle";
      return `${totalVehicles}x ${vehicleType}`;
    }
    if (contract.requirements?.vehicleType) {
      const qty = contract.requirements?.quantity || 1;
      return `${qty}x ${contract.requirements.vehicleType}`;
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
    return (
      contract.financials?.totalAmount ||
      contract.totalAmount ||
      contract.quotationId?.quotedPrice ||
      contract.amount ||
      0
    );
  };

  const getCurrency = () => {
    return contract.financials?.currency || getActiveCurrency();
  };

  return (
    <div className="drivemego-b2b_contractcard-contract-card">
      <div className="drivemego-b2b_contractcard-contract-top">
        <div>
          <h4 className="drivemego-b2b_contractcard-contract-title">
            {contract.corporateOwnerId?.companyName ||
              contract.corporateOwnerId?.fullName ||
              "Client"}
          </h4>
          <p className="drivemego-b2b_contractcard-contract-org">
            {contract.contractNumber || contract.corporateOwnerId?.email || ""}
          </p>
        </div>
        <span
          className={`drivemego-b2b_contractcard-status ${getStatusColor(contract.status)}`}
        >
          {contract.status?.toLowerCase() || "pending"}
        </span>
      </div>

      <div className="drivemego-b2b_contractcard-contract-details">
        <div>
          <span className="drivemego-b2b_contractcard-detail-label">
            CONTRACT VALUE
          </span>
          <span className="drivemego-b2b_contractcard-detail-text">
            {getContractValue().toLocaleString()} {getCurrency()}
          </span>
        </div>
        <div>
          <span className="drivemego-b2b_contractcard-detail-label">
            DURATION
          </span>
          <span className="drivemego-b2b_contractcard-detail-text">
            {calculateDuration(contract.startDate, contract.endDate)}
          </span>
        </div>
        <div>
          <span className="drivemego-b2b_contractcard-detail-label">
            REQUIREMENTS
          </span>
          <span className="drivemego-b2b_contractcard-detail-text">
            {getRequirements()}
          </span>
        </div>
      </div>

      <div className="drivemego-b2b_contractcard-contract-bottom">
        <div className="drivemego-b2b_contractcard-payment">
          <span
            className={`drivemego-b2b_contractcard-dot ${contract.financials?.advancePayment?.status === "PAID" || contract.paymentStatus === "PAID" ? "drivemego-b2b_contractcard-paid" : ""}`}
          ></span>
          <span>
            Payment:{" "}
            {contract.financials?.advancePayment?.status ||
              contract.paymentStatus ||
              "Pending"}
          </span>
        </div>
        {isManaged ? (
          <button
            className="drivemego-b2b_contractcard-manage-link drivemego-b2b_contractcard-managed-btn"
            onClick={() =>
              navigate("/b2b-partner/managed-operations", {
                state: { contractId: contract._id },
              })
            }
          >
            Manage Operations
          </button>
        ) : (
          <button className="drivemego-b2b_contractcard-manage-link">
            Manage Contract
          </button>
        )}
      </div>
      {isManaged && (
        <div className="drivemego-b2b_contractcard-managed-tag">
          Managed Service — you run operations for this client
        </div>
      )}
      </div>
  );
}

export default B2B_ContractCard;
