"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Car, Truck, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { selectUserRole } from "../../../Redux/selectors/authSelectors";
import "./ServiceSelection.css";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";

const ServiceSelection = () => {
  const navigate = useNavigate();
  const userRole = useSelector(selectUserRole);
  // Resolve the active business segment. A logged-in customer's role is the
  // source of truth (CORPORATE vs SCHOOL_CUSTOMER); guests who entered via the
  // navbar "School" tab are resolved from the persisted serviceSegment. School
  // customers may ONLY take Managed Services from their school partner.
  const isSchoolCustomer =
    userRole === "SCHOOL_CUSTOMER" ||
    (userRole !== "CORPORATE" &&
      localStorage.getItem("serviceSegment") === "school");
  const [selectedService, setSelectedService] = useState(
    isSchoolCustomer ? "managed" : null
  );
  const [activeTab, setActiveTab] = useState("corporate");

  useEffect(() => {
    // Persist the resolved segment so the navbar highlights the correct tab and
    // the downstream discovery step stays within the right segment.
    localStorage.setItem(
      "serviceSegment",
      isSchoolCustomer ? "school" : "corporate"
    );
    localStorage.setItem("activeTab", "corporate");
  }, [isSchoolCustomer]);

  const services = [
    {
      id: "passenger",
      title: "Passenger Vehicles",
      description:
        "Sedans, SUVs, Vans for employee transportation, executive travel, or client meetings",
      Icon: Car,
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
    // {
    //   id: "goods",
    //   title: "Goods Carrier",
    //   description:
    //     "Pickup trucks, cargo vans, mini trucks for delivery, logistics, or material transport",
    //   Icon: Truck,
    //   features: [
    //     "Pickup trucks",
    //     "Cargo vans",
    //     "Small trucks (1-3 ton)",
    //     "Refrigerated vehicles",
    //     "Box trucks",
    //   ],
    //   useCases:
    //     "Ideal for e-commerce, logistics, construction material delivery",
    // },
    {
      id: "managed",
      title: "Managed Services",
      description:
        "Full fleet management with drivers, maintenance, fuel, insurance - hassle-free solution",
      Icon: ShieldCheck,
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

  // School customers only ever see the Managed Services option.
  const visibleServices = isSchoolCustomer
    ? services.filter((s) => s.id === "managed")
    : services;

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
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="drivemego-service-selection-container">
        <div className="drivemego-service-selection-content">
          {/* Stepper */}
          <div className="drivemego-service-steps" aria-hidden="true">
            <div className="drivemego-service-step drivemego-step-active">
              <span className="drivemego-step-dot">1</span>
              <span className="drivemego-step-label">Service</span>
            </div>
            <span className="drivemego-step-line" />
            <div className="drivemego-service-step">
              <span className="drivemego-step-dot">2</span>
              <span className="drivemego-step-label">Requirements</span>
            </div>
            <span className="drivemego-step-line" />
            <div className="drivemego-service-step">
              <span className="drivemego-step-dot">3</span>
              <span className="drivemego-step-label">Quotation</span>
            </div>
          </div>

          <div className="drivemego-service-header">
            <span className="drivemego-service-eyebrow">
              Corporate & Business Mobility
            </span>
            <h1>Select Your Service Type</h1>
            <p>
              {isSchoolCustomer
                ? "Choose a managed transportation service from your school partner"
                : "Choose the type of vehicles or service you need for your business"}
            </p>
          </div>

          <div
            className={`drivemego-services-grid${
              visibleServices.length === 1 ? " drivemego-single" : ""
            }`}
          >
            {visibleServices.map((service) => {
              const ServiceIcon = service.Icon;
              const isSelected = selectedService === service.id;
              return (
                <div
                  key={service.id}
                  className={`drivemego-service-card ${
                    isSelected ? "drivemego-selected" : ""
                  }`}
                  onClick={() => handleServiceSelect(service.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleServiceSelect(service.id);
                    }
                  }}
                >
                  {isSelected && (
                    <div className="drivemego-selected-indicator">
                      <Check size={14} strokeWidth={3} /> Selected
                    </div>
                  )}

                  <div className="drivemego-service-icon">
                    <ServiceIcon size={26} strokeWidth={1.8} />
                  </div>
                  <h3>{service.title}</h3>
                  <p className="drivemego-service-description">
                    {service.description}
                  </p>

                  <div className="drivemego-service-features">
                    <h4>What&apos;s included</h4>
                    <ul>
                      {service.features.map((feature, index) => (
                        <li key={index}>
                          <Check size={15} strokeWidth={2.5} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="drivemego-service-use-case">
                    <p>
                      <strong>Best for</strong> {service.useCases}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="drivemego-service-actions">
            <button
              className="drivemego-continue-btn"
              onClick={handleContinue}
              disabled={!selectedService}
            >
              Continue to Customize Requirements
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ServiceSelection;
