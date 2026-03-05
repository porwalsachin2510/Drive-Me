"use client";
import { useNavigate } from "react-router-dom";
import "./QuotationCard.css";

const QuotationCard = ({ quotation }) => {

  const totalQuantity = quotation?.vehicles?.reduce(
    (sum, v) => sum + (v.quantity || 0),
    0
  );

  const navigate = useNavigate();

  // Map API status to display status
  const mapStatus = (apiStatus) => {
    const statusMap = {
      REQUESTED: "pending",
      QUOTED: "responded",
      ACCEPTED: "accepted",
      REJECTED: "rejected",
      EXPIRED: "expired",
    };
    return statusMap[apiStatus] || "pending";
  };

  const getStatusClass = (apiStatus) => {
    const status = mapStatus(apiStatus);
    const statusClasses = {
      pending: "status-pending",
      responded: "status-responded",
      accepted: "status-accepted",
      rejected: "status-rejected",
      expired: "status-expired",
    };
    return statusClasses[status] || "status-pending";
  };

  const getStatusIcon = (apiStatus) => {
    const status = mapStatus(apiStatus);
    const statusIcons = {
      pending: "fa-clock",
      responded: "fa-reply",
      accepted: "fa-check-circle",
      rejected: "fa-times-circle",
      expired: "fa-hourglass-end",
    };
    return statusIcons[status] || "fa-clock";
  };

  const getStatusLabel = (apiStatus) => {
    const status = mapStatus(apiStatus);
    const labels = {
      pending: "Pending",
      responded: "Responded",
      accepted: "Accepted",
      rejected: "Rejected",
      expired: "Expired",
    };
    return labels[status] || "Pending";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KWD",
      minimumFractionDigits: 0,
    })
      .format(price)
      .replace("KWD", "KD");
  };

  const handleViewDetails = () => {
    navigate(`/quotation/${quotation._id}`);
  };

  // Extract vehicle data from API response
  const vehicle =
    quotation.vehicleId && quotation.vehicleId[0]
      ? quotation.vehicleId[0]
      : null;
  const fleetOwner = quotation.fleetOwnerId || null;

  // Extract rental period details
  const rentalPeriod = quotation.rentalPeriod || {};
  const duration = `${rentalPeriod.duration || 0} ${
    rentalPeriod.durationType || "MONTHLY"
  }`.toLowerCase();

  return (
    <div className="quotation-card" onClick={handleViewDetails}>
      <div className="quotation-header">
        <div className="quotation-id">
          <i className="fas fa-file-invoice"></i>
          <span>#{quotation.quotationNumber || quotation._id.slice(-8)}</span>
        </div>
        <div className={`quotation-status ${getStatusClass(quotation.status)}`}>
          <i className={`fas ${getStatusIcon(quotation.status)}`}></i>
          <span>{getStatusLabel(quotation.status)}</span>
        </div>
      </div>

      <div className="quotation-content">
        {vehicle && (
          <div className="vehicle-info">
            {vehicle.images && vehicle.images[0] && (
              <img
                src={vehicle.images[0]}
                alt={`${vehicle.make || ""} ${vehicle.model || ""}`}
                className="vehicle-thumbnail"
                onError={(e) => {
                  e.target.src = "/placeholder.svg";
                }}
              />
            )}
            <div className="vehicle-details">
              <h4>
                {vehicle.make || "Unknown"} {vehicle.model || "Vehicle"}
              </h4>
              <p>
                {vehicle.year || "N/A"} •{" "}
                {vehicle.vehicleType || vehicle.registrationNumber || "Vehicle"}
              </p>
            </div>
          </div>
        )}

        <div className="quotation-info-grid">
          <div className="info-item">
            <i className="fas fa-calendar-alt"></i>
            <div>
              <span className="info-label">Requested On</span>
              <span className="info-value">
                {formatDate(quotation.requestedAt || quotation.createdAt)}
              </span>
            </div>
          </div>

          <div className="info-item">
            <i className="fas fa-clock"></i>
            <div>
              <span className="info-label">Duration</span>
              <span className="info-value">{duration}</span>
            </div>
          </div>

          <div className="info-item">
            <i className="fas fa-users"></i>
            <div>
              <span className="info-label">Quantity</span>
              <span className="info-value">{totalQuantity} Vehicle(s)</span>
            </div>
          </div>

          <div className="info-item">
            <i className="fas fa-cog"></i>
            <div>
              <span className="info-label">Requirements</span>
              <span className="info-value">
                {quotation.requirements?.withDriver
                  ? "With Driver"
                  : "Self Drive"}
                {quotation.requirements?.fuelIncluded ? " • Fuel Included" : ""}
              </span>
            </div>
          </div>
        </div>

        {quotation.quotedPrice && quotation.quotedPrice.totalPrice && (
          <div className="response-section">
            <div className="response-header">
              <i className="fas fa-reply"></i>
              <span>Fleet Owner Response</span>
            </div>
            <div className="response-details">
              <div className="price-detail">
                <span>Total Price:</span>
                <span className="price-value">
                  {formatPrice(quotation.quotedPrice.totalPrice)}
                </span>
              </div>
              {quotation.quotedPrice.message && (
                <p className="response-message">
                  {quotation.quotedPrice.message}
                </p>
              )}
              {quotation.quotedPrice.quotedAt && (
                <span className="response-date">
                  Responded on {formatDate(quotation.quotedPrice.quotedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {quotation.specialRequirements && (
          <div className="special-requirements">
            <i className="fas fa-info-circle"></i>
            <p>{quotation.specialRequirements}</p>
          </div>
        )}
      </div>

      <div className="quotation-footer">
        <div className="fleet-owner-info">
          {fleetOwner && (
            <>
              {/* <img
                src={fleetOwner.companyLogo || "/default-avatar.png"}
                alt={fleetOwner.companyName || fleetOwner.email}
                className="owner-avatar"
                onError={(e) => {
                  e.target.src = "/default-avatar.png";
                }}
              /> */}
              <span>{fleetOwner.companyName || fleetOwner.fullName}</span>
            </>
          )}
        </div>
        <button className="view-details-btn" onClick={handleViewDetails}>
          View Details
          <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};

export default QuotationCard;
