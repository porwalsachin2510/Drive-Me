"use client";

import { useState } from "react";
import VehicleCard from "../../B2C_Vehicle/VehicleCard/VehicleCard";
import AddVehicleModal from "../../B2C_Vehicle/AddVehicleModal/AddVehicleModal";
import "./vehicles.css";

function Vehicles() {
  const [showModal, setShowModal] = useState(false);

  const vehicles = [
    {
      id: 1,
      model: "Toyota Coaster",
      plate: "40-1234",
      year: 2022,
      status: "Active",
      nextService: "2024-06-15",
    },
    {
      id: 2,
      model: "Hyundai H1",
      plate: "15-9988",
      year: 2021,
      status: "Maintenance",
      nextService: "2024-04-01",
    },
  ];

  return (
    <div className="b2c-vehicles">
      <div className="b2c-vehicles-header">
        <h2 className="b2c-section-title">My Fleet</h2>
        <button
          className="b2c-add-vehicle-btn"
          onClick={() => setShowModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 4V14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M4 9H14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Add Vehicle
        </button>
      </div>

      <div className="b2c-vehicles-grid">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>

      {showModal && <AddVehicleModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default Vehicles;
