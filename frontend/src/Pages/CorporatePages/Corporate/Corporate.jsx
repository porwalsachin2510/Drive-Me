"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import { searchVehicles } from "../../../Redux/slices/vehicleSlice";
import PriceComparison from "../../../Components/Corporate/PriceComparison/PriceComparison";
import "./corporate.css";

const Corporate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const serviceType = location.state?.serviceType || "passenger";

  const [activeTab, setActiveTab] = useState("corporate");
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    localStorage.setItem("activeTab", "corporate");
  }, []);

  const [filters, setFilters] = useState({
    serviceType: serviceType,
    vehicleType: "",
    // numberOfVehicles: 1,
    minseatsrequired: 1,
    rentalDuration: "monthly",
    // usageEstimate: "medium",
    durationValue: "",
    budget: "",
    location: "",
    startDate: "",
    driverRequired: true,
    fuelIncluded: false,
    features: [],
  });

  console.log("My Search Parameters", filters);

  const vehicleTypeOptions = {
    passenger: [
      { value: "SEDAN", label: "Sedan", icon: "🚗" },
      { value: "SUV", label: "SUV", icon: "🚙" },
      { value: "LUXURY_COACH", label: "Luxury Coach", icon: "🏎️" },
      { value: "MINIVAN", label: "Minivan", icon: "🚐" },
      { value: "COASTER_BUS", label: "Coaster Bus", icon: "🚐" },
    ],
    goods: [
      { value: "PICKUP_1TON", label: "Pickup 1 Ton", icon: "🛻" },
      { value: "PICKUP_3TON", label: "Pickup 3 Ton", icon: "🛻" },
      { value: "TRUCK_7TON", label: "Truck 7 Ton", icon: "🚛" },
      { value: "REEFER_TRUCK", label: "Reefer Truck", icon: "❄️" },
      { value: "FLATBED_TRAILER", label: "Flatbed Trailer", icon: "🚚" },
    ],
    managed: [
      { value: "SHUTTLE_BUS", label: "Shuttle Bus", icon: "🚐" },
      { value: "EXECUTIVE_VAN", label: "Executive Van", icon: "🚐" },
    ],
  };

  const MinimumSeatsRequiredOptions = {
    passenger: [
      { value: "1", label: "Minimum Seats Required *", placeholder: "5 Seats" },
    ],

    goods: [
      {
        value: "3",
        label: "Cargo Capacity Required *",
        placeholder: "3 Tons",
      },
    ],

    managed: [
      { value: "30", label: "Minimum Seats Required", placeholder: "30 Seats" },
    ],
  };

  const rentalDurationOptions = [
    {
      value: "daily",
      label: "Daily Rental",
      description: "Perfect for short-term needs",
      unit: "days",
      placeholder: "e.g. 5",
    },
    {
      value: "weekly",
      label: "Weekly Rental",
      description: "Save up to 20% vs daily",
      unit: "weeks",
      placeholder: "e.g. 2",
    },
    {
      value: "monthly",
      label: "Monthly Rental",
      description: "Most popular - Save up to 72%",
      unit: "months",
      placeholder: "e.g. 3",
    },
    {
      value: "long-term",
      label: "Long-term (Yearly)",
      description: "Best value for extended periods",
      unit: "years",
      placeholder: "e.g. 1",
    },
  ];
  // const usageEstimateOptions = [
  //   {
  //     value: "low",
  //     label: "Low (< 1000 km/month)",
  //     description: "Occasional use",
  //   },
  //   {
  //     value: "medium",
  //     label: "Medium (1000-2500 km/month)",
  //     description: "Regular use",
  //   },
  //   {
  //     value: "high",
  //     label: "High (2500-4000 km/month)",
  //     description: "Heavy use",
  //   },
  //   {
  //     value: "very-high",
  //     label: "Very High (4000+ km/month)",
  //     description: "Intensive use",
  //   },
  // ];

  const budgetRanges = {
    daily: [
      { value: "0-1500", label: "Less than 1,500 AED (Budget)" },
      { value: "1500-3000", label: "1,500-3,000 AED (Economy)" },
      { value: "3000-6000", label: "3,000-6,000 AED (Standard)" },
      { value: "6000+", label: "6,000+ AED (Premium)" },
    ],
    weekly: [
      { value: "0-9000", label: "Less than 9,000 AED (Budget)" },
      { value: "9000-18000", label: "9,000-18,000 AED (Economy)" },
      { value: "18000-35000", label: "18,000-35,000 AED (Standard)" },
      { value: "35000+", label: "35,000+ AED (Premium)" },
    ],
    monthly: [
      { value: "0-10000", label: "Less than 10,000 AED (Budget)" },
      { value: "10000-25000", label: "10,000-25,000 AED (Economy)" },
      { value: "25000-50000", label: "25,000-50,000 AED (Standard)" },
      { value: "50000+", label: "50,000+ AED (Premium)" },
    ],
    "long-term": [
      { value: "0-8000", label: "Less than 8,000 AED/month (Budget)" },
      { value: "8000-20000", label: "8,000-20,000 AED/month (Economy)" },
      { value: "20000-40000", label: "20,000-40,000 AED/month (Standard)" },
      { value: "40000+", label: "40,000+ AED/month (Premium)" },
    ],
  };

  const featureOptions = [
    "GPS Tracking",
    "Dash Camera",
    "Premium Sound System",
    "Leather Seats",
    "Sunroof",
    "Backup Camera",
    "Parking Sensors",
    "Bluetooth",
    "USB Charging",
    "Child Safety Seats",
  ];

  const locations = [
    "Dubai",
    "Abu Dhabi",
    "Sharjah",
    "Ajman",
    "Kuwait City",
    "Doha",
    "Riyadh",
    "Jeddah",
  ];

  const handleInputChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFeatureToggle = (feature) => {
    setFilters((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!filters.vehicleType) {
      errors.vehicleType = "Please select a vehicle type";
    }
    if (!filters.minseatsrequired || filters.minseatsrequired < 1) {
      errors.minseatsrequired = "Please enter minimum seats/capacity required";
    }
    if (!filters.rentalDuration) {
      errors.rentalDuration = "Please select a rental duration";
    }
    if (!filters.durationValue || filters.durationValue < 1) {
      errors.durationValue = "Please enter the duration value";
    }
    if (!filters.budget) {
      errors.budget = "Please select a budget range";
    }
    if (!filters.location) {
      errors.location = "Please select a location";
    }
    if (!filters.startDate) {
      errors.startDate = "Please select a start date";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSearch = async () => {
    if (!validateForm()) {
      // Scroll to the first error
      const firstErrorElement = document.querySelector(".filter-section-error");
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    try {
      const result = await dispatch(searchVehicles(filters)).unwrap();
      navigate("/search-results", { state: { filters, results: result } });
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  // Get current duration option details
  const getCurrentDurationOption = () => {
    return rentalDurationOptions.find(
      (opt) => opt.value === filters.rentalDuration,
    );
  };

  const getDurationLabel = () => {
    const option = getCurrentDurationOption();
    if (!option || !filters.durationValue) return "";
    const value = Number.parseInt(filters.durationValue);
    const unit = option.unit;
    // Simple pluralization logic
    return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
  };

  return (
    <>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="customize-requirements-container">
        <div className="customize-content">
          <div className="customize-header">
            <h1>Customize Your Requirements</h1>
            <p>Filter and find the perfect vehicles for your business needs</p>
          </div>

          <div className="filter-form">
            {/* Vehicle Type Selection */}
            <div
              className={`filter-section ${validationErrors.vehicleType ? "filter-section-error" : ""}`}
            >
              <h3>Select Vehicle Type *</h3>
              <div className="vehicle-type-grid">
                {vehicleTypeOptions[serviceType].map((type) => (
                  <div
                    key={type.value}
                    className={`vehicle-type-option ${
                      filters.vehicleType === type.value ? "selected" : ""
                    }`}
                    onClick={() => handleInputChange("vehicleType", type.value)}
                  >
                    <span className="vehicle-icon">{type.icon}</span>
                    <span className="vehicle-label">{type.label}</span>
                  </div>
                ))}
              </div>
              {validationErrors.vehicleType && (
                <span className="validation-error">
                  {validationErrors.vehicleType}
                </span>
              )}
            </div>

            {MinimumSeatsRequiredOptions[serviceType].map((type) => (
              <div className="filter-section" key={type.value}>
                <h3>{type.label}</h3>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder={type.placeholder}
                  value={filters.minseatsrequired}
                  onChange={(e) =>
                    handleInputChange(
                      "minseatsrequired",
                      Number.parseInt(e.target.value),
                    )
                  }
                  className="input-field"
                />
              </div>
            ))}
            {/* Number of Vehicles */}
            {/* <div className="filter-section">
            <h3>Number of Vehicles</h3>
            <input
              type="number"
              min="1"
              max="100"
              value={filters.numberOfVehicles}
              onChange={(e) =>
                handleInputChange(
                  "numberOfVehicles",
                  Number.parseInt(e.target.value)
                )
              }
              className="input-field"
            />
          </div> */}
            {/* Rental Duration */}
            <div
              className={`filter-section ${validationErrors.rentalDuration ? "filter-section-error" : ""}`}
            >
              <h3>Rental Duration *</h3>
              <div className="duration-options">
                {rentalDurationOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`duration-option ${
                      filters.rentalDuration === option.value ? "selected" : ""
                    }`}
                    onClick={() =>
                      handleInputChange("rentalDuration", option.value)
                    }
                  >
                    <div className="duration-label">{option.label}</div>
                    <div className="duration-description">
                      {option.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {filters.rentalDuration && (
              <div
                className={`filter-section ${validationErrors.durationValue ? "filter-section-error" : ""}`}
              >
                <h3>Enter Duration in {getCurrentDurationOption()?.unit} *</h3>
                <div className="duration-input-container">
                  <input
                    type="number"
                    min="1"
                    placeholder={getCurrentDurationOption()?.placeholder}
                    value={filters.durationValue}
                    onChange={(e) =>
                      handleInputChange("durationValue", e.target.value)
                    }
                    className="input-field"
                  />
                  {filters.durationValue && (
                    <p className="duration-preview-text">
                      Total Duration: <strong>{getDurationLabel()}</strong>
                    </p>
                  )}
                  {validationErrors.durationValue && (
                    <span className="validation-error">
                      {validationErrors.durationValue}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Usage Estimate */}
            {/* <div className="filter-section">
            <h3>Per KM Usage Estimate</h3>
            <div className="usage-options">
              {usageEstimateOptions.map((option) => (
                <div
                  key={option.value}
                  className={`usage-option ${
                    filters.usageEstimate === option.value ? "selected" : ""
                  }`}
                  onClick={() =>
                    handleInputChange("usageEstimate", option.value)
                  }
                >
                  <div className="usage-label">{option.label}</div>
                  <div className="usage-description">{option.description}</div>
                </div>
              ))}
            </div>
          </div> */}
            {/* Budget */}
            <div
              className={`filter-section ${validationErrors.budget ? "filter-section-error" : ""}`}
            >
              <h3>Budget Per Vehicle *</h3>
              <select
                value={filters.budget}
                onChange={(e) => handleInputChange("budget", e.target.value)}
                className="select-field"
              >
                <option value="">Select Budget Range</option>
                {budgetRanges[filters.rentalDuration].map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              {validationErrors.budget && (
                <span className="validation-error">
                  {validationErrors.budget}
                </span>
              )}
            </div>
            {/* Location */}
            <div
              className={`filter-section ${validationErrors.location ? "filter-section-error" : ""}`}
            >
              <h3>Location *</h3>
              <select
                value={filters.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                className="select-field"
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {validationErrors.location && (
                <span className="validation-error">
                  {validationErrors.location}
                </span>
              )}
            </div>
            {/* Start Date */}
            <div
              className={`filter-section ${validationErrors.startDate ? "filter-section-error" : ""}`}
            >
              <h3>Required Start Date *</h3>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="input-field"
                min={new Date().toISOString().split("T")[0]}
              />
              {validationErrors.startDate && (
                <span className="validation-error">
                  {validationErrors.startDate}
                </span>
              )}
            </div>
            {/* Additional Options */}
            <div className="filter-section">
              <h3>Additional Requirements</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.driverRequired}
                    onChange={(e) =>
                      handleInputChange("driverRequired", e.target.checked)
                    }
                  />
                  <span>Driver Required</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.fuelIncluded}
                    onChange={(e) =>
                      handleInputChange("fuelIncluded", e.target.checked)
                    }
                  />
                  <span>Fuel Included</span>
                </label>
              </div>
            </div>
            {/* Features */}
            <div className="filter-section">
              <h3>Preferred Features</h3>
              <div className="features-grid">
                {featureOptions.map((feature) => (
                  <div
                    key={feature}
                    className={`feature-chip ${
                      filters.features.includes(feature) ? "selected" : ""
                    }`}
                    onClick={() => handleFeatureToggle(feature)}
                  >
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            {/* Price Comparison */}
            <PriceComparison
              rentalDuration={filters.rentalDuration}
              numberOfVehicles={filters.numberOfVehicles}
            />
            {/* Search Button */}
            <div className="btn-filter-actions">
              <button className="search-btn" onClick={handleSearch}>
                Search Vehicles
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Corporate;
