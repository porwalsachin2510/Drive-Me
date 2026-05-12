"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addVehicle, clearError } from "../../../../Redux/slices/vehicleSlice";
import {
  useDropdownOptions,
  DROPDOWN_CATEGORIES,
} from "../../../../hooks/useDropdownOptions";
import "./b2b_addvehiclemodal.css";

const B2B_AddVehicleModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.vehicles);

  // Fetch dynamic dropdown options
  const { options: dropdownOptions, loading: dropdownLoading } =
    useDropdownOptions([
      DROPDOWN_CATEGORIES.LOCATIONS,
      DROPDOWN_CATEGORIES.CURRENCIES,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_PASSENGER,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_GOODS,
      DROPDOWN_CATEGORIES.VEHICLE_CATEGORIES_MANAGED,
    ]);

  const [formData, setFormData] = useState({
    vehicleName: "",
    registrationNumber: "",
    manufacturingYear: new Date().getFullYear(),
    vehicleCategory: "SEDAN",
    serviceType: "PASSENGER",
    capacity: {
      seatingCapacity: 0,
      cargoCapacity: 0,
    },

    location: "",
    driverAvailability: {
      withDriver: true,
      withoutDriver: true,
    },
    fuelOptions: {
      fuelIncluded: true,
      withoutFuel: true,
    },
    facilities: {
      airConditioning: true,
      wifiOnboard: false,
      wheelchairAccess: false,
      gpsTracking: true,
      musicSystem: true,
      entertainmentScreen: false,
      refrigeration: false,
    },
    pricing: {
      currency: "AED",
      dailyRate: 0,
      weeklyRate: 0,
      monthlyRate: 0,
      yearlyRate: 0,
      perKmCharge: 0,
      driverCharges: 0,
      fuelCharges: 0,
      additionalCharges: {
        overtime: 0,
        waitingTime: 0,
      },
    },
    kmLimits: {
      dailyLimit: 100,
      weeklyLimit: 700,
      monthlyLimit: 2000,
      yearlyLimit: 24000,
    },
    availability: {
      availableDays: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      availableTimeSlots: [
        {
          startTime: "00:00",
          endTime: "23:59",
        },
      ],
      blackoutDates: [],
      minimumBookingDuration: 1,
    },
    status: "AVAILABLE",
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [documents, setDocuments] = useState({
    registration: null,
    insurance: null,
    inspection: null,
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic dropdown options from backend
  const locations = dropdownOptions[
    DROPDOWN_CATEGORIES.LOCATIONS
  ]?.options?.map((opt) => opt.value) || [
    "Dubai",
    "Abu Dhabi",
    "Sharjah",
    "Ajman",
    "Kuwait City",
    "Doha",
    "Riyadh",
    "Jeddah",
  ];

  const currencies = dropdownOptions[DROPDOWN_CATEGORIES.CURRENCIES]
    ?.options || [
    { value: "AED", label: "AED - UAE Dirham" },
    { value: "KWD", label: "KWD - Kuwaiti Dinar" },
    { value: "SAR", label: "SAR - Saudi Riyal" },
  ];

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

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // Default vehicle category for each service type
  const defaultCategoryByServiceType = {
    PASSENGER: "SEDAN",
    GOODS_CARRIER: "PICKUP_1TON",
    MANAGED_SERVICES: "SHUTTLE_BUS",
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
  };;

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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 10) {
      alert("Maximum 10 images allowed");
      return;
    }

    setImages([...images, ...files]);

    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...previews]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleDocumentChange = (e, docType) => {
    setDocuments({
      ...documents,
      [docType]: e.target.files[0],
    });
    // Clear validation error when document is uploaded
    if (validationErrors[docType]) {
      setValidationErrors((prev) => ({ ...prev, [docType]: "" }));
    }
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
    } else if (formData.registrationNumber.trim().length < 4) {
      errors.registrationNumber =
        "Registration number must be at least 4 characters";
    }

    const currentYear = new Date().getFullYear();
    if (!formData.manufacturingYear) {
      errors.manufacturingYear = "Manufacturing year is required";
    } else if (
      formData.manufacturingYear < 2000 ||
      formData.manufacturingYear > currentYear + 1
    ) {
      errors.manufacturingYear = `Year must be between 2000 and ${currentYear + 1}`;
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

    // Document Validations - At least registration is required
    if (!documents.registration) {
      errors.registration = "Registration certificate is required";
    }
    if (!documents.insurance) {
      errors.insurance = "Insurance certificate is required";
    }

    // Image Validation
    if (images.length === 0) {
      errors.images = "At least one vehicle image is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run validation
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector(
        ".b2b-operator-dashboard-add-vehicle-field-error",
      );
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

   // Set submitting state to show loading on button
    setIsSubmitting(true);

    try {
      const submitData = new FormData();

      submitData.append("vehicleName", formData.vehicleName);
      submitData.append("registrationNumber", formData.registrationNumber);
      submitData.append("manufacturingYear", formData.manufacturingYear);
      submitData.append("vehicleCategory", formData.vehicleCategory);
      submitData.append("serviceType", formData.serviceType);
      submitData.append("status", formData.status);
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
      submitData.append("availability", JSON.stringify(formData.availability));

      images.forEach((image) => {
        submitData.append("images", image);
      });

      if (documents.registration) {
        submitData.append("registration", documents.registration);
      }
      if (documents.insurance) {
        submitData.append("insurance", documents.insurance);
      }
      if (documents.inspection) {
        submitData.append("inspection", documents.inspection);
      }

      const result = await dispatch(addVehicle(submitData));

      if (addVehicle.fulfilled.match(result)) {
        // Show success alert
        alert("Vehicle added successfully! Your vehicle is pending approval.");
        // Close modal after success
        onClose();
      } else {
        // Show error if submission failed
        alert(result.payload || "Failed to add vehicle. Please try again.");
      }
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("An error occurred while adding the vehicle. Please try again.");
    } finally {
      // Reset submitting state
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
    () => navigate("/");
  };

  return (
    <>
      <div className="b2b-operator-dashboard-add-vehicle-modal-overlay">
        <div className="b2b-operator-dashboard-add-vehicle-modal-content">
          <div className="b2b-operator-dashboard-add-vehicle-modal-header">
            <h2>Add New Vehicle</h2>
            <button
              className="b2b-operator-dashboard-add-vehicle-modal-close"
              onClick={onClose}
            >
              ✕
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
                    🚗
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
                    🚚
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
                    🏢
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
                    onChange={(e) => {
                      handleInputChange(e);
                      if (validationErrors.vehicleName) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          vehicleName: "",
                        }));
                      }
                    }}
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
                    onChange={(e) => {
                      handleInputChange(e);
                      if (validationErrors.registrationNumber) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          registrationNumber: "",
                        }));
                      }
                    }}
                    placeholder="e.g., ABC-1234"
                    required
                  />
                  {validationErrors.registrationNumber && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.registrationNumber}
                    </span>
                  )}
                </div>

                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.manufacturingYear ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <label>Manufacturing Year *</label>
                  <input
                    type="number"
                    name="manufacturingYear"
                    value={formData.manufacturingYear}
                    onChange={(e) => {
                      handleInputChange(e);
                      if (validationErrors.manufacturingYear) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          manufacturingYear: "",
                        }));
                      }
                    }}
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    required
                  />
                  {validationErrors.manufacturingYear && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.manufacturingYear}
                    </span>
                  )}
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
                      onChange={(e) => {
                        handleNestedChange(
                          "capacity",
                          "seatingCapacity",
                          Number.parseInt(e.target.value) || 0,
                        );
                        if (validationErrors.seatingCapacity) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            seatingCapacity: "",
                          }));
                        }
                      }}
                      min="2"
                      max="100"
                      required
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
                      onChange={(e) => {
                        handleNestedChange(
                          "capacity",
                          "cargoCapacity",
                          Number.parseFloat(e.target.value),
                        );
                        if (validationErrors.cargoCapacity) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            cargoCapacity: "",
                          }));
                        }
                      }}
                      min="0"
                      step="0.1"
                      required
                    />
                    {validationErrors.cargoCapacity && (
                      <span className="b2b-operator-dashboard-add-vehicle-error-text">
                        {validationErrors.cargoCapacity}
                      </span>
                    )}
                  </div>
                )}

                {/* Location */}
                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.location ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <h3>Location *</h3>
                  <select
                    name="location"
                    value={formData.location}
                    onChange={(e) => {
                      handleInputChange(e);
                      if (validationErrors.location) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          location: "",
                        }));
                      }
                    }}
                    className="b2b-operator-dashboard-add-vehicle-select-field"
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
                  <select
                    value={formData.pricing.currency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          currency: e.target.value,
                        },
                      })
                    }
                    required
                  >
                    {currencies.map((currency) => (
                      <option key={currency.value} value={currency.value}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Driver & Fuel Options */}
            <div className="b2b-operator-dashboard-add-vehicle-form-section">
              <h2>Driver & Fuel Options</h2>
              <div className="b2b-operator-dashboard-add-vehicle-form-grid">
                <div className="b2b-operator-dashboard-add-vehicle-form-group b2b-operator-dashboard-add-vehicle-checkbox-group">
                  <label>
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
                    <span>Available With Driver</span>
                  </label>
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group b2b-operator-dashboard-add-vehicle-checkbox-group">
                  <label>
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
                    <span>Available Without Driver</span>
                  </label>
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group b2b-operator-dashboard-add-vehicle-checkbox-group">
                  <label>
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
                    <span>Fuel Included Option</span>
                  </label>
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group b2b-operator-dashboard-add-vehicle-checkbox-group">
                  <label>
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
                    <span>Without Fuel Option</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Facilities */}
            <div className="b2b-operator-dashboard-add-vehicle-form-section">
              <h2>Facilities & Amenities</h2>
              <div className="b2b-operator-dashboard-add-vehicle-features-grid">
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.airConditioning}
                    onChange={() => handleFacilityToggle("airConditioning")}
                  />
                  <span>Air Conditioning</span>
                </label>
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.wifiOnboard}
                    onChange={() => handleFacilityToggle("wifiOnboard")}
                  />
                  <span>WiFi Onboard</span>
                </label>
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.wheelchairAccess}
                    onChange={() => handleFacilityToggle("wheelchairAccess")}
                  />
                  <span>Wheelchair Access</span>
                </label>
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.gpsTracking}
                    onChange={() => handleFacilityToggle("gpsTracking")}
                  />
                  <span>GPS Tracking</span>
                </label>
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.musicSystem}
                    onChange={() => handleFacilityToggle("musicSystem")}
                  />
                  <span>Music System</span>
                </label>
                <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.facilities.entertainmentScreen}
                    onChange={() => handleFacilityToggle("entertainmentScreen")}
                  />
                  <span>Entertainment Screen</span>
                </label>
                {formData.serviceType === "GOODS_CARRIER" && (
                  <label className="b2b-operator-dashboard-add-vehicle-feature-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.facilities.refrigeration}
                      onChange={() => handleFacilityToggle("refrigeration")}
                    />
                    <span>Refrigeration</span>
                  </label>
                )}
              </div>
            </div>

            {/* Pricing */}
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
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          dailyRate: Number.parseFloat(e.target.value),
                        },
                      });
                      if (validationErrors.dailyRate) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          dailyRate: "",
                        }));
                      }
                    }}
                    step="0.01"
                    min="0"
                    required
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
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          weeklyRate: Number.parseFloat(e.target.value),
                        },
                      });
                      if (validationErrors.weeklyRate) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          weeklyRate: "",
                        }));
                      }
                    }}
                    step="0.01"
                    min="0"
                    required
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
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          monthlyRate: Number.parseFloat(e.target.value),
                        },
                      });
                      if (validationErrors.monthlyRate) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          monthlyRate: "",
                        }));
                      }
                    }}
                    step="0.01"
                    min="0"
                    required
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
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          yearlyRate: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                    placeholder="Optional - for long-term rentals"
                  />
                  <small style={{ color: "#666", fontSize: "11px" }}>
                    Leave 0 to auto-calculate from monthly rate
                  </small>
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Per KM Charge</label>
                  <input
                    type="number"
                    value={formData.pricing.perKmCharge}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          perKmCharge: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Driver Charges (per day)</label>
                  <input
                    type="number"
                    value={formData.pricing.driverCharges}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          driverCharges: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Fuel Charges (per day)</label>
                  <input
                    type="number"
                    value={formData.pricing.fuelCharges}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          fuelCharges: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Overtime Rate (per hour)</label>
                  <input
                    type="number"
                    value={formData.pricing.additionalCharges.overtime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          additionalCharges: {
                            ...formData.pricing.additionalCharges,
                            overtime: Number.parseFloat(e.target.value),
                          },
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Waiting Time Charge (per hour)</label>
                  <input
                    type="number"
                    value={formData.pricing.additionalCharges.waitingTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          additionalCharges: {
                            ...formData.pricing.additionalCharges,
                            waitingTime: Number.parseFloat(e.target.value),
                          },
                        },
                      })
                    }
                    step="0.01"
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

            {/* Images */}
            <div
              className={`b2b-operator-dashboard-add-vehicle-form-section ${validationErrors.images ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
            >
              <h2>Vehicle Images (Max 10) *</h2>
              <div className="b2b-operator-dashboard-add-vehicle-image-upload-section">
                <label
                  htmlFor="images"
                  className="b2b-operator-dashboard-add-vehicle-upload-button"
                >
                  <span>Upload Images</span>
                  <input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleImageChange(e);
                      if (validationErrors.images) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          images: "",
                        }));
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                {validationErrors.images && (
                  <span className="b2b-operator-dashboard-add-vehicle-error-text">
                    {validationErrors.images}
                  </span>
                )}

                {imagePreviews.length > 0 && (
                  <div className="b2b-operator-dashboard-add-vehicle-image-previews">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={index}
                        className="b2b-operator-dashboard-add-vehicle-image-preview"
                      >
                        <img
                          src={preview || "/placeholder.svg"}
                          alt={`Preview ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="b2b-operator-dashboard-add-vehicle-remove-image"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Documents */}
            <div className="b2b-operator-dashboard-add-vehicle-form-section">
              <h2>Documents</h2>
              <p className="b2b-operator-dashboard-add-vehicle-section-note">
                Registration and Insurance certificates are required for vehicle
                approval
              </p>
              <div className="b2b-operator-dashboard-add-vehicle-documents-grid">
                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.registration ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <label>Registration Certificate (RC) *</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentChange(e, "registration")}
                  />
                  {documents.registration && (
                    <span className="file-name file-uploaded">
                      {documents.registration.name}
                    </span>
                  )}
                  {validationErrors.registration && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.registration}
                    </span>
                  )}
                </div>

                <div
                  className={`b2b-operator-dashboard-add-vehicle-form-group ${validationErrors.insurance ? "b2b-operator-dashboard-add-vehicle-field-error" : ""}`}
                >
                  <label>Insurance Certificate *</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentChange(e, "insurance")}
                  />
                  {documents.insurance && (
                    <span className="file-name file-uploaded">
                      {documents.insurance.name}
                    </span>
                  )}
                  {validationErrors.insurance && (
                    <span className="b2b-operator-dashboard-add-vehicle-error-text">
                      {validationErrors.insurance}
                    </span>
                  )}
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Inspection Certificate</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentChange(e, "inspection")}
                  />
                  {documents.inspection && (
                    <span className="file-name file-uploaded">
                      {documents.inspection.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="b2b-operator-dashboard-add-vehicle-form-actions">
              <button
                type="button"
                className="b2b-operator-dashboard-add-vehicle-btn-secondary"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="b2b-operator-dashboard-add-vehicle-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="b2b-operator-dashboard-add-vehicle-btn-spinner"></span>
                    Adding Vehicle...
                  </>
                ) : (
                  "Add Vehicle"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};;

export default B2B_AddVehicleModal;
