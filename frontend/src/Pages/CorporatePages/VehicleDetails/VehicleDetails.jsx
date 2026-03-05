"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getVehicleById } from "../../../Redux/slices/vehicleSlice";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import "./VehicleDetails.css";

const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentVehicle, loading, error } = useSelector(
    (state) => state.vehicles
  );
  const { user } = useSelector((state) => state.auth);

  const [selectedImage, setSelectedImage] = useState(0);
  const [rentalDuration, setRentalDuration] = useState("monthly");

  useEffect(() => {
    dispatch(getVehicleById(id));
  }, [id, dispatch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-page">Error: {error}</div>;
  if (!currentVehicle)
    return <div className="error-page">Vehicle not found</div>;

  const vehicle = currentVehicle;

  const handleRequestQuotation = () => {
    if (!user) {
      navigate("/login", { state: { from: `/vehicle/${id}` } });
      return;
    }
    navigate("/quotation-request", { state: { vehicle, rentalDuration } });
  };

  const handleViewPortfolio = () => {
    navigate(`/fleet-portfolio/${vehicle.fleetOwnerId._id}`);
  };

  const getPriceByDuration = () => {
    switch (rentalDuration) {
      case "daily":
        return vehicle.pricing?.dailyRate || 0;
      case "weekly":
        return vehicle.pricing?.weeklyRate || 0;
      case "monthly":
        return vehicle.pricing?.monthlyRate || 0;
      case "long-term":
        return vehicle.pricing?.monthlyRate
          ? vehicle.pricing.monthlyRate * 0.85
          : 0;
      default:
        return vehicle.pricing?.monthlyRate || 0;
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat("en-KW", {
      style: "currency",
      currency: "KWD",
    }).format(amount);
  };

  return (
    <div className="vehicle-details-container">
      <div className="vehicle-details-content">
        {/* Image Gallery */}
        <div className="image-gallery">
          <div className="main-image">
            <img
              src={vehicle.photos?.[selectedImage]?.url || "/placeholder.svg"}
              alt={vehicle.vehicleName}
              onError={(e) => (e.target.src = "/placeholder.svg")}
            />
          </div>
          <div className="thumbnail-list">
            {vehicle.photos?.map((photo, index) => (
              <div
                key={index}
                className={`thumbnail ${
                  selectedImage === index ? "active" : ""
                }`}
                onClick={() => setSelectedImage(index)}
              >
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt={`${vehicle.vehicleName} ${index + 1}`}
                  onError={(e) => (e.target.src = "/placeholder.svg")}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="vehicle-info">
          <div className="vehicle-header">
            <h1>{vehicle.vehicleName}</h1>
            <div className="vehicle-meta">
              <span className="vehicle-type">
                {vehicle.vehicleCategory?.replace(/_/g, " ")}
              </span>
              <span className="service-type">
                {vehicle.serviceType?.replace(/_/g, " ")}
              </span>
              {vehicle.rating > 0 && (
                <span className="rating">
                  ⭐ {vehicle.rating.toFixed(1)} ({vehicle.totalReviews || 0}{" "}
                  reviews)
                </span>
              )}
            </div>
          </div>

          {/* Fleet Owner Info */}
          {vehicle.fleetOwnerId && (
            <div className="fleet-owner-card">
              <div className="owner-info">
                <img
                  src={
                    vehicle.fleetOwnerId.profileImage || "/default-avatar.png"
                  }
                  alt={vehicle.fleetOwnerId.name}
                  className="owner-avatar"
                  onError={(e) => (e.target.src = "/default-avatar.png")}
                />
                <div className="owner-details">
                  <h4>{vehicle.fleetOwnerId.name}</h4>
                  <p>{vehicle.fleetOwnerId.businessName}</p>
                  <p className="owner-stats">
                    {vehicle.fleetOwnerId.rating &&
                      `★ ${vehicle.fleetOwnerId.rating.toFixed(1)}`}
                  </p>
                </div>
              </div>
              <button
                className="view-portfolio-btn"
                onClick={handleViewPortfolio}
              >
                View Portfolio
              </button>
            </div>
          )}

          {/* Pricing Section */}
          <div className="pricing-section">
            <h3>Select Rental Duration</h3>
            <div className="duration-selector">
              <button
                className={rentalDuration === "daily" ? "active" : ""}
                onClick={() => setRentalDuration("daily")}
              >
                Daily
              </button>
              <button
                className={rentalDuration === "weekly" ? "active" : ""}
                onClick={() => setRentalDuration("weekly")}
              >
                Weekly
              </button>
              <button
                className={rentalDuration === "monthly" ? "active" : ""}
                onClick={() => setRentalDuration("monthly")}
              >
                Monthly
              </button>
              <button
                className={rentalDuration === "long-term" ? "active" : ""}
                onClick={() => setRentalDuration("long-term")}
              >
                Long-term (3+ months)
              </button>
            </div>

            <div className="price-display">
              <div className="price-amount">
                <span className="amount">
                  {formatPrice(getPriceByDuration())}
                </span>
                <span className="period">
                  /
                  {rentalDuration === "daily"
                    ? "day"
                    : rentalDuration === "weekly"
                    ? "week"
                    : "month"}
                </span>
              </div>

              <div className="price-breakdown">
                {vehicle.pricing?.driverCharges > 0 && (
                  <div className="breakdown-item">
                    <span>Driver Charges:</span>
                    <span>{formatPrice(vehicle.pricing.driverCharges)}</span>
                  </div>
                )}
                {vehicle.kmLimits?.monthlyLimit && (
                  <div className="breakdown-item">
                    <span>Monthly KM Limit:</span>
                    <span>{vehicle.kmLimits.monthlyLimit} km</span>
                  </div>
                )}
                {vehicle.pricing?.perKmCharge && (
                  <div className="breakdown-item">
                    <span>Per KM (beyond limit):</span>
                    <span>{formatPrice(vehicle.pricing.perKmCharge)}</span>
                  </div>
                )}
                {vehicle.pricing?.additionalCharges?.overtime && (
                  <div className="breakdown-item">
                    <span>Overtime Rate:</span>
                    <span>
                      {formatPrice(vehicle.pricing.additionalCharges.overtime)}
                      /hour
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              className="request-quotation-btn"
              onClick={handleRequestQuotation}
            >
              Request Quotation
            </button>
          </div>

          {/* Specifications */}
          <div className="specifications-section">
            <h3>Specifications</h3>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-label">Registration:</span>
                <span className="spec-value">{vehicle.registrationNumber}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Year:</span>
                <span className="spec-value">{vehicle.manufacturingYear}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Category:</span>
                <span className="spec-value">
                  {vehicle.vehicleCategory?.replace(/_/g, " ")}
                </span>
              </div>
              {vehicle.capacity?.seatingCapacity && (
                <div className="spec-item">
                  <span className="spec-label">Seats:</span>
                  <span className="spec-value">
                    {vehicle.capacity.seatingCapacity}
                  </span>
                </div>
              )}
              {vehicle.capacity?.cargoCapacity && (
                <div className="spec-item">
                  <span className="spec-label">Cargo Capacity:</span>
                  <span className="spec-value">
                    {vehicle.capacity.cargoCapacity} tons
                  </span>
                </div>
              )}
              <div className="spec-item">
                <span className="spec-label">Service Type:</span>
                <span className="spec-value">
                  {vehicle.serviceType?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Features */}
          {vehicle.facilities && (
            <div className="features-section">
              <h3>Features & Facilities</h3>
              <div className="features-list">
                {vehicle.facilities.airConditioning && (
                  <div className="feature-item">✓ Air Conditioning</div>
                )}
                {vehicle.facilities.wifiOnboard && (
                  <div className="feature-item">✓ WiFi Onboard</div>
                )}
                {vehicle.facilities.wheelchairAccess && (
                  <div className="feature-item">✓ Wheelchair Access</div>
                )}
                {vehicle.facilities.gpsTracking && (
                  <div className="feature-item">✓ GPS Tracking</div>
                )}
                {vehicle.facilities.musicSystem && (
                  <div className="feature-item">✓ Music System</div>
                )}
                {vehicle.facilities.entertainmentScreen && (
                  <div className="feature-item">✓ Entertainment Screen</div>
                )}
                {vehicle.facilities.refrigeration && (
                  <div className="feature-item">✓ Refrigeration</div>
                )}
              </div>
            </div>
          )}

          {/* Driver & Fuel Options */}
          <div className="options-section">
            <h3>Available Options</h3>
            <div className="options-grid">
              {vehicle.driverAvailability?.withDriver && (
                <div className="option-item">
                  <i className="fas fa-check-circle"></i>
                  <span>With Driver</span>
                </div>
              )}
              {vehicle.driverAvailability?.withoutDriver && (
                <div className="option-item">
                  <i className="fas fa-check-circle"></i>
                  <span>Without Driver</span>
                </div>
              )}
              {vehicle.fuelOptions?.fuelIncluded && (
                <div className="option-item">
                  <i className="fas fa-check-circle"></i>
                  <span>Fuel Included</span>
                </div>
              )}
              {vehicle.fuelOptions?.withoutFuel && (
                <div className="option-item">
                  <i className="fas fa-check-circle"></i>
                  <span>Without Fuel</span>
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
          {vehicle.availability?.availableDays?.length > 0 && (
            <div className="availability-section">
              <h3>Availability</h3>
              <div className="available-days">
                {vehicle.availability.availableDays.map((day, index) => (
                  <span key={index} className="day-badge">
                    {day}
                  </span>
                ))}
              </div>
              {vehicle.availability.minimumBookingDuration && (
                <p className="min-booking">
                  Minimum booking: {vehicle.availability.minimumBookingDuration}{" "}
                  days
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleDetails;
