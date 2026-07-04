"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import { searchVehicles } from "../../../Redux/slices/vehicleSlice";
import PriceComparison from "../../../Components/Corporate/PriceComparison/PriceComparison";
import { isSearchFormComplete } from "../../../utils/searchValidation";
import {
  useDropdownOptions,
  DROPDOWN_CATEGORIES,
} from "../../../hooks/useDropdownOptions";
import {
  normalizeCountry,
  getActiveCountry,
  getCountryLocations,
  getCurrencyForLocation,
} from "../../../config/localeConfig";
import "./corporate.css";

const Corporate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const serviceType = location.state?.serviceType || "passenger";

  const [activeTab, setActiveTab] = useState("corporate");
  const [validationErrors, setValidationErrors] = useState({});

  // The corporate account's country (identity-locked). Locations and currency
  // are scoped to this so a Kuwait corporate only sees Kuwait cities + KWD and
  // a UAE corporate only sees UAE cities + AED. Data-driven via localeConfig.
  const formCountry = normalizeCountry(user?.country) || getActiveCountry();

  // Currency for the budget dropdown: driven by the chosen location's country,
  // falling back to the corporate's own country currency.
  const resolveBudgetCurrency = (locationName) =>
    getCurrencyForLocation(locationName, formCountry);

  // Format budget label with dynamic currency
  const formatBudgetLabel = (option, currency) => {
    if (!option.label) return option.label;

    // Remove existing currency codes from label
    let label = option.label
      .replace(/AED/g, "")
      .replace(/KWD/g, "")
      .replace(/\/month/g, "")
      .trim();

    // Extract category type from label (Budget, Economy, Standard, Premium)
    const categoryMatch = label.match(/\((Budget|Economy|Standard|Premium)\)/);
    const category = categoryMatch ? categoryMatch[1] : "";

    // Clean up the numeric part
    label = label.replace(/\((Budget|Economy|Standard|Premium)\)/, "").trim();

    // Add the correct currency
    if (label.includes("Less than")) {
      const numMatch = label.match(/Less than ([\d,]+)/);
      if (numMatch) {
        return `Less than ${numMatch[1]} ${currency}${category ? ` (${category})` : ""}`;
      }
    } else if (label.includes("+")) {
      const numMatch = label.match(/([\d,]+)\+/);
      if (numMatch) {
        return `${numMatch[1]}+ ${currency}${category ? ` (${category})` : ""}`;
      }
    } else if (label.includes("-")) {
      const numMatch = label.match(/([\d,]+)-([\d,]+)/);
      if (numMatch) {
        return `${numMatch[1]}-${numMatch[2]} ${currency}${category ? ` (${category})` : ""}`;
      }
    }

    return `${label} ${currency}${category ? ` (${category})` : ""}`;
  };

  // Fetch dynamic dropdown options
  // eslint-disable-next-line no-unused-vars
  const { options: dropdownOptions, loading: dropdownLoading } =
    useDropdownOptions([
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_PASSENGER,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_GOODS,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_MANAGED,
      DROPDOWN_CATEGORIES.LOCATIONS,
      DROPDOWN_CATEGORIES.RENTAL_DURATIONS,
      DROPDOWN_CATEGORIES.BUDGET_RANGES_DAILY,
      DROPDOWN_CATEGORIES.BUDGET_RANGES_WEEKLY,
      DROPDOWN_CATEGORIES.BUDGET_RANGES_MONTHLY,
      DROPDOWN_CATEGORIES.BUDGET_RANGES_LONGTERM,
      DROPDOWN_CATEGORIES.VEHICLE_FEATURES,
      DROPDOWN_CATEGORIES.MIN_SEATS_PASSENGER,
      DROPDOWN_CATEGORIES.MIN_SEATS_GOODS,
      DROPDOWN_CATEGORIES.MIN_SEATS_MANAGED,
    ]);

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

  // Dynamic vehicle type options from backend with icon fallbacks
  const getVehicleIcon = (value) => {
    const icons = {
      SEDAN: "🚗",
      SUV: "🚙",
      LUXURY_COACH: "🏎️",
      MINIVAN: "🚐",
      COASTER_BUS: "🚐",
      PICKUP_1TON: "🛻",
      PICKUP_3TON: "🛻",
      TRUCK_7TON: "🚛",
      REEFER_TRUCK: "❄️",
      FLATBED_TRAILER: "🚚",
      SHUTTLE_BUS: "🚐",
      EXECUTIVE_VAN: "🚐",
      ANY_TYPE: "🛻",
    };
    return icons[value] || "🛻";
  };

  const vehicleTypeOptions = {
    passenger: (
      dropdownOptions[DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_PASSENGER]
        ?.options || [
        { value: "SEDAN", label: "Sedan" },
        { value: "SUV", label: "SUV" },
        { value: "LUXURY_COACH", label: "Luxury Coach" },
        { value: "MINIVAN", label: "Minivan" },
        { value: "COASTER_BUS", label: "Coaster Bus" },
      ]
    ).map((opt) => ({ ...opt, icon: getVehicleIcon(opt.value) })),
    goods: (
      dropdownOptions[DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_GOODS]
        ?.options || [
        { value: "PICKUP_1TON", label: "Pickup 1 Ton" },
        { value: "PICKUP_3TON", label: "Pickup 3 Ton" },
        { value: "TRUCK_7TON", label: "Truck 7 Ton" },
        { value: "REEFER_TRUCK", label: "Reefer Truck" },
        { value: "FLATBED_TRAILER", label: "Flatbed Trailer" },
      ]
    ).map((opt) => ({ ...opt, icon: getVehicleIcon(opt.value) })),
    managed: (
      dropdownOptions[DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_MANAGED]
        ?.options || [
        { value: "SHUTTLE_BUS", label: "Shuttle Bus" },
        { value: "EXECUTIVE_VAN", label: "Executive Van" },
      ]
    ).map((opt) => ({ ...opt, icon: getVehicleIcon(opt.value) })),
  };

  const MinimumSeatsRequiredOptions = {
    passenger: dropdownOptions[
      DROPDOWN_CATEGORIES.MIN_SEATS_PASSENGER
    ]?.options?.map((opt) => ({
      value: opt.value,
      label: opt.label,
      placeholder: opt.metadata?.placeholder || "5 Seats",
    })) || [
      { value: "1", label: "Minimum Seats Required *", placeholder: "5 Seats" },
    ],
    goods: dropdownOptions[DROPDOWN_CATEGORIES.MIN_SEATS_GOODS]?.options?.map(
      (opt) => ({
        value: opt.value,
        label: opt.label,
        placeholder: opt.metadata?.placeholder || "3 Tons",
      }),
    ) || [
      { value: "3", label: "Cargo Capacity Required *", placeholder: "3 Tons" },
    ],
    managed: dropdownOptions[
      DROPDOWN_CATEGORIES.MIN_SEATS_MANAGED
    ]?.options?.map((opt) => ({
      value: opt.value,
      label: opt.label,
      placeholder: opt.metadata?.placeholder || "30 Seats",
    })) || [
      { value: "30", label: "Minimum Seats Required", placeholder: "30 Seats" },
    ],
  };

  const rentalDurationOptions = dropdownOptions[
    DROPDOWN_CATEGORIES.RENTAL_DURATIONS
  ]?.options?.map((opt) => ({
    value: opt.value,
    label: opt.label,
    description: opt.description || "",
    unit: opt.metadata?.unit || "days",
    placeholder: opt.metadata?.placeholder || "e.g. 1",
  })) || [
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

  // Budget ranges without currency - currency is added dynamically based on location
  const budgetRanges = {
    daily: dropdownOptions[DROPDOWN_CATEGORIES.BUDGET_RANGES_DAILY]
      ?.options || [
      { value: "0-200", label: "Less than 200/day (Budget)" },
      { value: "200-500", label: "200-500/day (Economy)" },
      { value: "500-1000", label: "500-1,000/day (Standard)" },
      { value: "1000+", label: "1,000+/day (Premium)" },
    ],
    weekly: dropdownOptions[DROPDOWN_CATEGORIES.BUDGET_RANGES_WEEKLY]
      ?.options || [
      { value: "0-1000", label: "Less than 1,000/week (Budget)" },
      { value: "1000-2500", label: "1,000-2,500/week (Economy)" },
      { value: "2500-5000", label: "2,500-5,000/week (Standard)" },
      { value: "5000+", label: "5,000+/week (Premium)" },
    ],
    monthly: dropdownOptions[DROPDOWN_CATEGORIES.BUDGET_RANGES_MONTHLY]
      ?.options || [
      { value: "0-3000", label: "Less than 3,000/month (Budget)" },
      { value: "3000-8000", label: "3,000-8,000/month (Economy)" },
      { value: "8000-15000", label: "8,000-15,000/month (Standard)" },
      { value: "15000+", label: "15,000+/month (Premium)" },
    ],
    "long-term": dropdownOptions[DROPDOWN_CATEGORIES.BUDGET_RANGES_LONGTERM]
      ?.options || [
      { value: "0-30000", label: "Less than 30,000/year (Budget)" },
      { value: "30000-80000", label: "30,000-80,000/year (Economy)" },
      { value: "80000-150000", label: "80,000-150,000/year (Standard)" },
      { value: "150000+", label: "150,000+/year (Premium)" },
    ],
  };

  const featureOptions = dropdownOptions[
    DROPDOWN_CATEGORIES.VEHICLE_FEATURES
  ]?.options?.map((opt) => opt.value) || [
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

  // Locations are scoped to the corporate's country (multi-country). We do NOT
  // use the global LOCATIONS dropdown here because it mixes every country.
  const locations = getCountryLocations(formCountry);

  const handleInputChange = (field, value) => {
    setFilters((prev) => {
      // If rental duration changes, reset the budget since ranges are different
      if (field === "rentalDuration" && prev.rentalDuration !== value) {
        return {
          ...prev,
          [field]: value,
          budget: "", // Reset budget when duration type changes
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
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

            {/* Location - MUST be before Budget so currency can be determined */}
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

            {/* Budget - Currency is dynamically determined by location */}
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
                    {formatBudgetLabel(
                      range,
                      resolveBudgetCurrency(filters.location),
                    )}
                  </option>
                ))}
              </select>
              {validationErrors.budget && (
                <span className="validation-error">
                  {validationErrors.budget}
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
              <button
                className={`search-btn ${!isSearchFormComplete(filters) ? "disabled" : ""}`}
                onClick={handleSearch}
                disabled={!isSearchFormComplete(filters)}
              >
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
