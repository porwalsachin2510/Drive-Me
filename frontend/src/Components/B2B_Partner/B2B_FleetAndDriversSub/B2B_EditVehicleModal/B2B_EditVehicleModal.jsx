"use client";

import {
  getActiveCurrency,
  getActiveCountry,
  getCountryLocations,
} from "../../../../config/localeConfig";
import { useState, useEffect } from "react";
import api from "../../../../utils/api";
import LoadingSpinner from "../../../LoadingSpinner/LoadingSpinner";
import {
  useDropdownOptions,
  DROPDOWN_CATEGORIES,
} from "../../../../hooks/useDropdownOptions";
import "../B2B_AddVehicleModal/b2b_addvehiclemodal.css";
import { notify } from "../../../../utils/toast";

const B2B_EditVehicleModal = ({ vehicle, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch dynamic dropdown options
  const { options: dropdownOptions, loading: dropdownLoading } =
    useDropdownOptions([
      DROPDOWN_CATEGORIES.LOCATIONS,
      DROPDOWN_CATEGORIES.CURRENCIES,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_PASSENGER,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_GOODS,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_MANAGED,
    ]);

  // Default vehicle category for each service type
  const defaultCategoryByServiceType = {
    PASSENGER: "SEDAN",
    GOODS_CARRIER: "PICKUP_1TON",
    MANAGED_SERVICES: "SHUTTLE_BUS",
  };

  const [formData, setFormData] = useState({
    vehicleName: vehicle?.vehicleName || "",
    registrationNumber: vehicle?.registrationNumber || "",
    manufacturingYear: vehicle?.manufacturingYear || new Date().getFullYear(),
    vehicleCategory: vehicle?.vehicleCategory || "SEDAN",
    serviceType: vehicle?.serviceType || "PASSENGER",
    capacity: {
      seatingCapacity: vehicle?.capacity?.seatingCapacity || 0,
      cargoCapacity: vehicle?.capacity?.cargoCapacity || 0,
    },
    location: vehicle?.location || "",
    driverAvailability: {
      withDriver: vehicle?.driverAvailability?.withDriver ?? true,
      withoutDriver: vehicle?.driverAvailability?.withoutDriver ?? true,
    },
    fuelOptions: {
      fuelIncluded: vehicle?.fuelOptions?.fuelIncluded ?? true,
      withoutFuel: vehicle?.fuelOptions?.withoutFuel ?? true,
    },
    facilities: {
      airConditioning: vehicle?.facilities?.airConditioning ?? true,
      wifiOnboard: vehicle?.facilities?.wifiOnboard ?? false,
      wheelchairAccess: vehicle?.facilities?.wheelchairAccess ?? false,
      gpsTracking: vehicle?.facilities?.gpsTracking ?? true,
      musicSystem: vehicle?.facilities?.musicSystem ?? true,
      entertainmentScreen: vehicle?.facilities?.entertainmentScreen ?? false,
      refrigeration: vehicle?.facilities?.refrigeration ?? false,
    },
    pricing: {
      currency: vehicle?.pricing?.currency || getActiveCurrency(),
      dailyRate: vehicle?.pricing?.dailyRate || 0,
      weeklyRate: vehicle?.pricing?.weeklyRate || 0,
      monthlyRate: vehicle?.pricing?.monthlyRate || 0,
      yearlyRate: vehicle?.pricing?.yearlyRate || 0,
      perKmCharge: vehicle?.pricing?.perKmCharge || 0,
      driverCharges: vehicle?.pricing?.driverCharges || 0,
      fuelCharges: vehicle?.pricing?.fuelCharges || 0,
      additionalCharges: {
        overtime: vehicle?.pricing?.additionalCharges?.overtime || 0,
        waitingTime: vehicle?.pricing?.additionalCharges?.waitingTime || 0,
      },
    },
    kmLimits: {
      dailyLimit: vehicle?.kmLimits?.dailyLimit || 100,
      weeklyLimit: vehicle?.kmLimits?.weeklyLimit || 700,
      monthlyLimit: vehicle?.kmLimits?.monthlyLimit || 2000,
      yearlyLimit: vehicle?.kmLimits?.yearlyLimit || 24000,
    },
  });

  const [validationErrors, setValidationErrors] = useState({});

  // Identity-locked earner: locations and currency scoped to partner's country.
  const partnerCountry = getActiveCountry();
  const partnerCurrency = getActiveCurrency();
  const locations = getCountryLocations(partnerCountry);

  const vehicleCategories = {
    PASSENGER: dropdownOptions[DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_PASSENGER]
      ?.options || [
      { value: "SEDAN", label: "Sedan" },
      { value: "SUV", label: "SUV" },
      { value: "MINIVAN", label: "Minivan" },
      { value: "COASTER_BUS", label: "Coaster Bus" },
      { value: "LUXURY_COACH", label: "Luxury Coach" },
    ],
    GOODS_CARRIER: dropdownOptions[DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_GOODS]
      ?.options || [
      { value: "PICKUP_1TON", label: "Pickup 1 Ton" },
      { value: "PICKUP_3TON", label: "Pickup 3 Ton" },
      { value: "TRUCK_7TON", label: "Truck 7 Ton" },
      { value: "REEFER_TRUCK", label: "Reefer Truck" },
      { value: "FLATBED_TRAILER", label: "Flatbed Trailer" },
    ],
    MANAGED_SERVICES: dropdownOptions[
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_MANAGED
    ]?.options || [
      { value: "ANY_TYPE", label: "Any Type" },
      { value: "SHUTTLE_BUS", label: "Shuttle Bus" },
      { value: "EXECUTIVE_VAN", label: "Executive Van" },
    ],
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // When service type changes, reset the vehicle category to appropriate default
    if (name === "serviceType") {
      setFormData({
        ...formData,
        [name]: value,
        vehicleCategory: defaultCategoryByServiceType[value] || "SEDAN",
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === "checkbox" ? checked : value,
      });
    }
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData({
      ...formData,
      [parent]: {
        ...formData[parent],
        [field]: value,
      },
    });
  };

  const handleFacilityToggle = (facility) => {
    setFormData({
      ...formData,
      facilities: {
        ...formData.facilities,
        [facility]: !formData.facilities[facility],
      },
    });
  };

  // Comprehensive form validation
  const validateForm = () => {
    const errors = {};

    // Basic Information Validations
    if (!formData.vehicleName.trim()) {
      errors.vehicleName = "Vehicle name is required";
    } else if (formData.vehicleName.trim().length < 3) {
      errors.vehicleName = "Vehicle name must be at least 3 characters";
    }

    if (!formData.registrationNumber.trim()) {
      errors.registrationNumber = "Registration number is required";
    }

    if (!formData.location) {
      errors.location = "Location is required";
    }

    // Capacity Validations
    // Both PASSENGER and MANAGED_SERVICES need seating capacity (buses, shuttles carry passengers)
    if (
      formData.serviceType === "PASSENGER" ||
      formData.serviceType === "MANAGED_SERVICES"
    ) {
      if (
        !formData.capacity.seatingCapacity ||
        formData.capacity.seatingCapacity < 2
      ) {
        errors.seatingCapacity = "Seating capacity must be at least 2";
      } else if (formData.capacity.seatingCapacity > 100) {
        errors.seatingCapacity = "Seating capacity cannot exceed 100";
      }
    }

    if (formData.serviceType === "GOODS_CARRIER") {
      if (
        !formData.capacity.cargoCapacity ||
        formData.capacity.cargoCapacity <= 0
      ) {
        errors.cargoCapacity = "Cargo capacity must be greater than 0";
      }
    }

    // Pricing Validations
    if (formData.pricing.dailyRate <= 0) {
      errors.dailyRate = "Daily rate must be greater than 0";
    }
    if (formData.pricing.weeklyRate <= 0) {
      errors.weeklyRate = "Weekly rate must be greater than 0";
    }
    if (formData.pricing.monthlyRate <= 0) {
      errors.monthlyRate = "Monthly rate must be greater than 0";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run validation
    if (!validateForm()) {
      const firstError = document.querySelector(
        ".b2b-operator-dashboard-add-vehicle-field-error",
      );
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = new FormData();

      submitData.append("vehicleName", formData.vehicleName);
      submitData.append("registrationNumber", formData.registrationNumber);
      submitData.append("manufacturingYear", formData.manufacturingYear);
      submitData.append("vehicleCategory", formData.vehicleCategory);
      submitData.append("serviceType", formData.serviceType);
      submitData.append("location", formData.location);
      submitData.append("capacity", JSON.stringify(formData.capacity));
      submitData.append(
        "driverAvailability",
        JSON.stringify(formData.driverAvailability),
      );
      submitData.append("fuelOptions", JSON.stringify(formData.fuelOptions));
      submitData.append("facilities", JSON.stringify(formData.facilities));
      submitData.append("pricing", JSON.stringify(formData.pricing));
      submitData.append("kmLimits", JSON.stringify(formData.kmLimits));

      const response = await api.put(`/vehicles/${vehicle._id}`, submitData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        notify("Vehicle updated successfully!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Error updating vehicle:", err);
      setError(err.response?.data?.message || "Failed to update vehicle");
    } finally {
      setLoading(false);
    }
  };

  if (loading || dropdownLoading) return <LoadingSpinner />;

  return (
    <div className="b2b-operator-dashboard-add-vehicle-modal-overlay">
      <div className="b2b-operator-dashboard-add-vehicle-modal-content">
        <div className="b2b-operator-dashboard-add-vehicle-modal-header">
          <h2>Edit Vehicle</h2>
          <button
            className="b2b-operator-dashboard-add-vehicle-modal-close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        {error && (
          <div className="b2b-operator-dashboard-add-vehicle-error-message">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="b2b-operator-dashboard-add-vehicle-add-vehicle-form"
        >
          {/* Service Type */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Service Type</h2>
            <div className="b2b-operator-dashboard-add-vehicle-service-type-grid">
              <label
                className={`b2b-operator-dashboard-add-vehicle-service-type-card ${
                  formData.serviceType === "PASSENGER"
                    ? "b2b-operator-dashboard-add-vehicle-active"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value="PASSENGER"
                  checked={formData.serviceType === "PASSENGER"}
                  onChange={handleInputChange}
                />
                <div className="b2b-operator-dashboard-add-vehicle-service-icon">
                  {"\uD83D\uDE97"}
                </div>
                <h3>Passenger Vehicle</h3>
                <p>Cars, SUVs, Vans, Buses</p>
              </label>

              <label
                className={`b2b-operator-dashboard-add-vehicle-service-type-card ${
                  formData.serviceType === "GOODS_CARRIER"
                    ? "b2b-operator-dashboard-add-vehicle-active"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value="GOODS_CARRIER"
                  checked={formData.serviceType === "GOODS_CARRIER"}
                  onChange={handleInputChange}
                />
                <div className="b2b-operator-dashboard-add-vehicle-service-icon">
                  {"\uD83D\uDE9A"}
                </div>
                <h3>Goods Carrier</h3>
                <p>Trucks, Pickups for cargo</p>
              </label>

              <label
                className={`b2b-operator-dashboard-add-vehicle-service-type-card ${
                  formData.serviceType === "MANAGED_SERVICES"
                    ? "b2b-operator-dashboard-add-vehicle-active"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value="MANAGED_SERVICES"
                  checked={formData.serviceType === "MANAGED_SERVICES"}
                  onChange={handleInputChange}
                />
                <div className="b2b-operator-dashboard-add-vehicle-service-icon">
                  {"\uD83C\uDFE2"}
                </div>
                <h3>Managed Services</h3>
                <p>Full fleet management</p>
              </label>
            </div>
          </div>

          {/* Basic Information */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Basic Information</h2>
            <div className="b2b-operator-dashboard-add-vehicle-form-grid">
              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.vehicleName ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Vehicle Name *</label>
                <input
                  type="text"
                  name="vehicleName"
                  value={formData.vehicleName}
                  onChange={handleInputChange}
                  placeholder="e.g., Toyota Camry 2023"
                  required
                />
                {validationErrors.vehicleName && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.vehicleName}
                  </span>
                )}
              </div>

              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Vehicle Category *</label>
                <select
                  name="vehicleCategory"
                  value={formData.vehicleCategory}
                  onChange={handleInputChange}
                  required
                >
                  {(vehicleCategories[formData.serviceType] || []).map(
                    (cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.registrationNumber ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Registration Number *</label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., ABC-1234"
                  required
                />
                {validationErrors.registrationNumber && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.registrationNumber}
                  </span>
                )}
              </div>

              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Manufacturing Year *</label>
                <input
                  type="number"
                  name="manufacturingYear"
                  value={formData.manufacturingYear}
                  onChange={handleInputChange}
                  min="2000"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>

              {/* Show Seating Capacity for PASSENGER and MANAGED_SERVICES (buses, shuttles need seats) */}
              {(formData.serviceType === "PASSENGER" ||
                formData.serviceType === "MANAGED_SERVICES") && (
                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.seatingCapacity ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <label>Seating Capacity *</label>
                  <input
                    type="number"
                    value={formData.capacity.seatingCapacity}
                    onChange={(e) =>
                      handleNestedChange(
                        "capacity",
                        "seatingCapacity",
                        Number.parseInt(e.target.value) || 0,
                      )
                    }
                    min="2"
                    max="100"
                  />
                  {validationErrors.seatingCapacity && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.seatingCapacity}
                    </span>
                  )}
                </div>
              )}

              {formData.serviceType === "GOODS_CARRIER" && (
                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.cargoCapacity ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <label>Cargo Capacity (tons) *</label>
                  <input
                    type="number"
                    value={formData.capacity.cargoCapacity}
                    onChange={(e) =>
                      handleNestedChange(
                        "capacity",
                        "cargoCapacity",
                        Number.parseFloat(e.target.value),
                      )
                    }
                    min="0.5"
                    step="0.5"
                    placeholder="e.g., 3"
                  />
                  {validationErrors.cargoCapacity && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.cargoCapacity}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.location ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Location *</label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                {validationErrors.location && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Currency & Pricing */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Currency & Pricing</h2>
            <div className="b2b-operator-dashboard-add-vehicle-form-grid">
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Currency *</label>
                {/* Currency is locked to the partner's country currency. */}
                <select
                  value={formData.pricing.currency}
                  disabled
                  aria-readonly="true"
                >
                  <option value={formData.pricing.currency || partnerCurrency}>
                    {formData.pricing.currency || partnerCurrency}
                  </option>
                </select>
                <small className="b2b-operator-dashboard-add-vehicle-help-text">
                  Pricing is set in your account currency (
                  {formData.pricing.currency || partnerCurrency}).
                </small>
              </div>
            </div>
          </div>

          {/* Driver & Fuel Options */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Driver & Fuel Options</h2>
            <div className="b2b-operator-dashboard-add-vehicle-checkbox-grid">
              <label className="b2b-operator-dashboard-add-vehicle-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.driverAvailability.withDriver}
                  onChange={(e) =>
                    handleNestedChange(
                      "driverAvailability",
                      "withDriver",
                      e.target.checked,
                    )
                  }
                />
                Available With Driver
              </label>
              <label className="b2b-operator-dashboard-add-vehicle-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.driverAvailability.withoutDriver}
                  onChange={(e) =>
                    handleNestedChange(
                      "driverAvailability",
                      "withoutDriver",
                      e.target.checked,
                    )
                  }
                />
                Available Without Driver
              </label>
              <label className="b2b-operator-dashboard-add-vehicle-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.fuelOptions.fuelIncluded}
                  onChange={(e) =>
                    handleNestedChange(
                      "fuelOptions",
                      "fuelIncluded",
                      e.target.checked,
                    )
                  }
                />
                Fuel Included Option
              </label>
              <label className="b2b-operator-dashboard-add-vehicle-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.fuelOptions.withoutFuel}
                  onChange={(e) =>
                    handleNestedChange(
                      "fuelOptions",
                      "withoutFuel",
                      e.target.checked,
                    )
                  }
                />
                Without Fuel Option
              </label>
            </div>
          </div>

          {/* Facilities & Amenities */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Facilities & Amenities</h2>
            <div className="b2b-operator-dashboard-add-vehicle-facilities-grid">
              {Object.entries(formData.facilities).map(([key, value]) => (
                <label
                  key={key}
                  className="b2b-operator-dashboard-add-vehicle-feature-checkbox"
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => handleFacilityToggle(key)}
                  />
                  <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pricing Details */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>Pricing Details ({formData.pricing.currency})</h2>
            <div className="b2b-operator-dashboard-add-vehicle-form-grid">
              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.dailyRate ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Daily Rate *</label>
                <input
                  type="number"
                  value={formData.pricing.dailyRate}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "dailyRate",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
                {validationErrors.dailyRate && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.dailyRate}
                  </span>
                )}
              </div>
              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.weeklyRate ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Weekly Rate *</label>
                <input
                  type="number"
                  value={formData.pricing.weeklyRate}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "weeklyRate",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
                {validationErrors.weeklyRate && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.weeklyRate}
                  </span>
                )}
              </div>
              <div
                className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.monthlyRate ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
              >
                <label>Monthly Rate *</label>
                <input
                  type="number"
                  value={formData.pricing.monthlyRate}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "monthlyRate",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
                {validationErrors.monthlyRate && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.monthlyRate}
                  </span>
                )}
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Yearly Rate (Long-term)</label>
                <input
                  type="number"
                  value={formData.pricing.yearlyRate}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "yearlyRate",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                  placeholder="Leave 0 to auto-calculate from monthly"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Per KM Charge</label>
                <input
                  type="number"
                  value={formData.pricing.perKmCharge}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "perKmCharge",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Driver Charges (per day)</label>
                <input
                  type="number"
                  value={formData.pricing.driverCharges}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "driverCharges",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Fuel Charges (per day)</label>
                <input
                  type="number"
                  value={formData.pricing.fuelCharges}
                  onChange={(e) =>
                    handleNestedChange(
                      "pricing",
                      "fuelCharges",
                      Number.parseFloat(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* KM Limits */}
          <div className="b2b-operator-dashboard-add-vehicle-form-section">
            <h2>KM Limits</h2>
            <div className="b2b-operator-dashboard-add-vehicle-form-grid">
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Daily KM Limit</label>
                <input
                  type="number"
                  value={formData.kmLimits.dailyLimit}
                  onChange={(e) =>
                    handleNestedChange(
                      "kmLimits",
                      "dailyLimit",
                      Number.parseInt(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Weekly KM Limit</label>
                <input
                  type="number"
                  value={formData.kmLimits.weeklyLimit}
                  onChange={(e) =>
                    handleNestedChange(
                      "kmLimits",
                      "weeklyLimit",
                      Number.parseInt(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Monthly KM Limit</label>
                <input
                  type="number"
                  value={formData.kmLimits.monthlyLimit}
                  onChange={(e) =>
                    handleNestedChange(
                      "kmLimits",
                      "monthlyLimit",
                      Number.parseInt(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
              <div className="b2b-operator-dashboard-add-vehicle-form-group">
                <label>Yearly KM Limit</label>
                <input
                  type="number"
                  value={formData.kmLimits.yearlyLimit}
                  onChange={(e) =>
                    handleNestedChange(
                      "kmLimits",
                      "yearlyLimit",
                      Number.parseInt(e.target.value),
                    )
                  }
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="b2b-operator-dashboard-add-vehicle-modal-actions">
            <button
              type="button"
              className="b2b-operator-dashboard-add-vehicle-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2b-operator-dashboard-add-vehicle-submit-btn"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default B2B_EditVehicleModal;
