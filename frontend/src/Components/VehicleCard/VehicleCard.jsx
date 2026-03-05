"use client";
import { useNavigate } from "react-router-dom";
import "./VehicleCard.css";

const VehicleCard = ({ vehicle }) => {

  console.log("vehicle ", vehicle );
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/vehicle/${vehicle._id}`);
  };

  const handleViewPortfolio = (e) => {
    e.stopPropagation();
    navigate(`/fleet-owner/${vehicle.owner._id}`);
  };

  
  const formatPrice = (price) => {
    if (!price) return "KD 0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KWD",
      minimumFractionDigits: 0,
    })
      .format(price)
      .replace("KWD", "KD");
  };

  const getPriceDisplay = () => {
    const prices = [];

    if (vehicle.pricing?.monthly?.baseRate) {
      prices.push({
        label: "Monthly",
        value: formatPrice(vehicle.pricing.monthly.baseRate),
        period: "/month",
      });
    }

    if (vehicle.pricing?.daily?.baseRate) {
      prices.push({
        label: "Daily",
        value: formatPrice(vehicle.pricing.daily.baseRate),
        period: "/day",
      });
    }

    if (vehicle.pricing?.weekly?.baseRate) {
      prices.push({
        label: "Weekly",
        value: formatPrice(vehicle.pricing.weekly.baseRate),
        period: "/week",
      });
    }

    return prices;
  };


  return (
    <div className="vehicle-card" onClick={handleViewDetails}>
      <div className="vehicle-card-image">
        <img
          src={vehicle.photos?.[0].url || "/placeholder-car.jpg"}
          alt={`${vehicle.make} ${vehicle.model}`}
          onError={(e) => (e.target.src = "/placeholder-car.jpg")}
        />
        {vehicle.status === "AVAILABLE" && (
          <span className="availability-badge available">Available</span>
        )}
        {vehicle.status === "UNAVAILABLE" && (
          <span className="availability-badge unavailable">Not Available</span>
        )}
        <div className="vehicle-card-overlay">
          <button className="view-details-btn">View Details</button>
        </div>
      </div>

      <div className="vehicle-card-content">
        <div className="vehicle-header">
          <h3 className="vehicle-title">
            {vehicle.make} {vehicle.model}
          </h3>
          <span className="vehicle-year">{vehicle.year}</span>
        </div>

        <div className="vehicle-specs">
          <div className="spec-item">
            <i className="fas fa-car"></i>
            <span>{vehicle.vehicleType}</span>
          </div>
          <div className="spec-item">
            <i className="fas fa-palette"></i>
            <span>{vehicle.color}</span>
          </div>
          <div className="spec-item">
            <i className="fas fa-users"></i>
            <span>{vehicle.seatingCapacity} Seats</span>
          </div>
          {vehicle.fuelType && (
            <div className="spec-item">
              <i className="fas fa-gas-pump"></i>
              <span>{vehicle.fuelType}</span>
            </div>
          )}
        </div>

        <div className="vehicle-features">
          {vehicle.features?.airConditioning && (
            <span className="feature-tag">
              <i className="fas fa-snowflake"></i> AC
            </span>
          )}
          {vehicle.features?.gps && (
            <span className="feature-tag">
              <i className="fas fa-map-marked-alt"></i> GPS
            </span>
          )}
          {vehicle.driverDetails?.driverIncluded && (
            <span className="feature-tag">
              <i className="fas fa-user-tie"></i> Driver
            </span>
          )}
          {vehicle.pricing?.fuelIncluded && (
            <span className="feature-tag">
              <i className="fas fa-gas-pump"></i> Fuel Inc.
            </span>
          )}
        </div>

        <div className="vehicle-pricing">
          {getPriceDisplay().map((price, index) => (
            <div key={index} className="price-option">
              <span className="price-label">{price.label}</span>
              <div className="price-value">
                <span className="price-amount">{price.value}</span>
                <span className="price-period">{price.period}</span>
              </div>
            </div>
          ))}
        </div>

        {vehicle.pricing?.perKmCharge && (
          <div className="per-km-info">
            <i className="fas fa-road"></i>
            <span>Per KM: {formatPrice(vehicle.pricing.perKmCharge)}</span>
          </div>
        )}

        <div className="vehicle-owner">
          <img
            src={vehicle.owner?.companyLogo || "/default-avatar.png"}
            alt={vehicle.owner?.companyName}
            className="owner-avatar"
            onError={(e) => (e.target.src = "/default-avatar.png")}
          />
          <div className="owner-info">
            <span className="owner-name">{vehicle.owner?.companyName}</span>
            <div className="owner-rating">
              <i className="fas fa-star"></i>
              <span>{vehicle.owner?.rating?.toFixed(1) || "New"}</span>
            </div>
          </div>
          <button className="view-portfolio-btn" onClick={handleViewPortfolio}>
            View Portfolio
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
