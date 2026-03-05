"use client";

import { useNavigate } from "react-router-dom";
import "./FleetPortfolioVehicleCard.css";

const FleetPortfolioVehicleCard = ({ vehicle, fleetOwner }) => {

    console.log("fleetOwner Vehicle Card", fleetOwner);
  const navigate = useNavigate();

  const formatPrice = (price) =>
    `KD ${new Intl.NumberFormat("en-US").format(price || 0)}`;

  return (
    <div
      className="vehicle-card"
      onClick={() => navigate(`/vehicle/${vehicle._id}`)}
    >
      <div className="vehicle-image">
        <img
          src={vehicle.photos?.[0]?.url || "/placeholder-car.jpg"}
          alt={vehicle.vehicleName}
        />
        <span className={`badge ${vehicle.status.toLowerCase()}`}>
          {vehicle.status}
        </span>
      </div>

      <div className="vehicle-content">
        <h3>{vehicle.vehicleName}</h3>
        <p>{vehicle.vehicleCategory}</p>

        <div className="vehicle-meta">
          <span>📅 {vehicle.manufacturingYear}</span>
          <span>👥 {vehicle.capacity.seatingCapacity} Seats</span>
        </div>

        <div className="features">
          {vehicle.facilities.airConditioning && <span>❄️ AC</span>}
          {vehicle.facilities.gpsTracking && <span>📍 GPS</span>}
          {vehicle.fuelOptions.fuelIncluded && <span>⛽ Fuel Included</span>}
          {vehicle.driverAvailability.withDriver && <span>👨‍✈️ Driver</span>}
        </div>

        <div className="pricing">
          <div>{formatPrice(vehicle.pricing.dailyRate)} / day</div>
          <div>{formatPrice(vehicle.pricing.weeklyRate)} / week</div>
          <div>{formatPrice(vehicle.pricing.monthlyRate)} / month</div>
        </div>

        <div className="owner">
          <strong>{fleetOwner.fullName}</strong>
          <span>{fleetOwner.whatsappNumber}</span>
        </div>
      </div>
    </div>
  );
};

export default FleetPortfolioVehicleCard;
