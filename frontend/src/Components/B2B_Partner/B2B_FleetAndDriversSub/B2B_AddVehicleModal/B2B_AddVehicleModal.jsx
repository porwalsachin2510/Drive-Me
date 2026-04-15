"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addVehicle, clearError } from "../../../../Redux/slices/vehicleSlice";
import LoadingSpinner from "../../../LoadingSpinner/LoadingSpinner";
import { useDropdownOptions, DROPDOWN_CATEGORIES } from "../../../../hooks/useDropdownOptions";
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

  console.log("FormData", formData);

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [documents, setDocuments] = useState({
    registration: null,
    insurance: null,
    inspection: null,
  });

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (images.length === 0) {
      alert("Please upload at least one vehicle image");
      return;
    }

    console.log("Preparing form submission...");
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

    console.log(`Appending ${images.length} images...`);
    images.forEach((image, index) => {
      console.log(`Image ${index + 1}:`, image.name, image.type, image.size);
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

    console.log("FormData prepared, dispatching...");

    console.log("submitData", submitData);

    const result = await dispatch(addVehicle(submitData));

    if (addVehicle.fulfilled.match(result)) {
      console.log("Vehicle added successfully!");
      alert("Vehicle added successfully!");
      // Close modal instead of navigating away - stay on current tab
      onClose();
    }
  };

  if (loading) return <LoadingSpinner />;

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
                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Vehicle Name *</label>
                  <input
                    type="text"
                    name="vehicleName"
                    value={formData.vehicleName}
                    onChange={handleInputChange}
                    placeholder="e.g., Toyota Camry 2023"
                    required
                  />
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

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Registration Number *</label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., ABC-1234"
                    required
                  />
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

                {formData.serviceType === "PASSENGER" && (
                  <div className="b2b-operator-dashboard-add-vehicle-form-group">
                    <label>Seating Capacity *</label>
                    <input
                      type="number"
                      value={formData.capacity.seatingCapacity}
                      onChange={(e) =>
                        handleNestedChange(
                          "capacity",
                          "seatingCapacity",
                          Number.parseInt(e.target.value),
                        )
                      }
                      min="2"
                      max="60"
                      required
                    />
                  </div>
                )}

                {formData.serviceType === "GOODS_CARRIER" && (
                  <div className="b2b-operator-dashboard-add-vehicle-form-group">
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
                      min="0"
                      step="0.1"
                      required
                    />
                  </div>
                )}

                {/* Location */}
                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <h3>Location</h3>
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="b2b-operator-dashboard-add-vehicle-select-field"
                  >
                    <option value="">Select Location</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
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
                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Daily Rate *</label>
                  <input
                    type="number"
                    value={formData.pricing.dailyRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          dailyRate: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Weekly Rate *</label>
                  <input
                    type="number"
                    value={formData.pricing.weeklyRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          weeklyRate: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Monthly Rate *</label>
                  <input
                    type="number"
                    value={formData.pricing.monthlyRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricing: {
                          ...formData.pricing,
                          monthlyRate: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    step="0.01"
                    min="0"
                    required
                  />
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
              </div>
            </div>

            {/* Images */}
            <div className="b2b-operator-dashboard-add-vehicle-form-section">
              <h2>Vehicle Images (Max 10) *</h2>
              <div className="b2b-operator-dashboard-add-vehicle-image-upload-section">
                <label
                  htmlFor="images"
                  className="b2b-operator-dashboard-add-vehicle-upload-button"
                >
                  <span>📷 Upload Images</span>
                  <input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                </label>

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
              <div className="b2b-operator-dashboard-add-vehicle-documents-grid">
                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Registration Certificate</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentChange(e, "registration")}
                  />
                  {documents.registration && (
                    <span className="file-name">
                      {documents.registration.name}
                    </span>
                  )}
                </div>

                <div className="b2b-operator-dashboard-add-vehicle-form-group">
                  <label>Insurance Certificate</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentChange(e, "insurance")}
                  />
                  {documents.insurance && (
                    <span className="file-name">
                      {documents.insurance.name}
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
                    <span className="file-name">
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
              >
                Cancel
              </button>
              <button
                type="submit"
                className="b2b-operator-dashboard-add-vehicle-btn-primary"
                disabled={loading}
              >
                {loading ? "Adding Vehicle..." : "Add Vehicle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};;;

export default B2B_AddVehicleModal;
