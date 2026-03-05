"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ServiceSelection.css";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";

const ServiceSelection = () => {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);

  const services = [
    {
      id: "passenger",
      title: "Passenger Vehicles",
      description:
        "Sedans, SUVs, Vans for employee transportation, executive travel, or client meetings",
      icon: "🚗",
      features: [
        "Executive sedans",
        "Family SUVs",
        "Luxury vehicles",
        "Staff transportation",
        "Airport transfers",
      ],
      useCases:
        "Perfect for corporate travel, employee shuttles, VIP transport",
    },
    {
      id: "goods",
      title: "Goods Carrier",
      description:
        "Pickup trucks, cargo vans, mini trucks for delivery, logistics, or material transport",
      icon: "🚚",
      features: [
        "Pickup trucks",
        "Cargo vans",
        "Small trucks (1-3 ton)",
        "Refrigerated vehicles",
        "Box trucks",
      ],
      useCases:
        "Ideal for e-commerce, logistics, construction material delivery",
    },
    {
      id: "managed",
      title: "Managed Services",
      description:
        "Full fleet management with drivers, maintenance, fuel, insurance - hassle-free solution",
      icon: "🎯",
      features: [
        "Professional drivers included",
        "Complete maintenance",
        "Fuel management",
        "Insurance coverage",
        "24/7 support",
      ],
      useCases:
        "Complete turnkey solution for businesses wanting zero fleet management hassle",
    },
  ];

  const handleServiceSelect = (serviceId) => {
    setSelectedService(serviceId);
  };

  const handleContinue = () => {
    if (selectedService) {
      navigate("/corporate", {
        state: { serviceType: selectedService },
      });
    }
  };

  return (
    <div className="homepage">
      
      <div className="service-selection-container">
        <div className="service-selection-content">
          <div className="service-header">
            <h1>Select Your Service Type</h1>
            <p>
              Choose the type of vehicles or service you need for your business
            </p>
          </div>

          <div className="services-grid">
            {services.map((service) => (
              <div
                key={service.id}
                className={`service-card ${
                  selectedService === service.id ? "selected" : ""
                }`}
                onClick={() => handleServiceSelect(service.id)}
              >
                <div className="service-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p className="service-description">{service.description}</p>

                <div className="service-features">
                  <h4>Features:</h4>
                  <ul>
                    {service.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="service-use-case">
                  <p>
                    <strong>Best For:</strong> {service.useCases}
                  </p>
                </div>

                {selectedService === service.id && (
                  <div className="selected-indicator">✓ Selected</div>
                )}
              </div>
            ))}
          </div>

          <div className="service-actions">
            <button
              className="continue-btn"
              onClick={handleContinue}
              disabled={!selectedService}
            >
              Continue to Customize Requirements
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default ServiceSelection;
