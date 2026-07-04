import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import ManagedServiceBriefModal from "../../../Components/Corporate/ManagedServiceBrief/ManagedServiceBriefModal";
import { requestQuotation } from "../../../Redux/slices/quotationSlice";
import "./SingleVehicleOwnerDetails.css";

const SingleVehicleOwnerDetails = () => {
  const location = useLocation();

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const corporateuserrequirements = location.state.userfilters;

  const user = useSelector((state) => state.auth.user);

  // Sample data structure
  const ownerData = location.state.results;

  const [selectedVehicles, setSelectedVehicles] = useState({});
  const [filterType, setFilterType] = useState("ALL");
  const [activeTab, setActiveTab] = useState("commuters");

  // Managed-service requests must carry an operations brief. We hold the built
  // quotation payload here while the corporate fills the brief in the modal,
  // then send both together in one atomic request.
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [pendingQuotation, setPendingQuotation] = useState(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  console.log("selectedVehicles:-", selectedVehicles);
  // Handle card click to select/deselect vehicle
  const handleCardClick = (vehicle) => {
    setSelectedVehicles((prev) => {
      // If vehicle is already selected, remove it
      if (prev[vehicle._id]) {
        // eslint-disable-next-line no-unused-vars
        const { [vehicle._id]: removed, ...rest } = prev;
        return rest;
      }
      // Otherwise, add it with quantity 1
      return {
        ...prev,
        [vehicle._id]: {
          quantity: 1,
          data: { vehicle },
          // userrequirements: { ...corporateuserrequirements },
        },
      };
    });
  };

  // Handle quantity change
  const handleQuantityChange = (vehicleId, action, e) => {
    // Prevent card click when clicking quantity buttons
    e.stopPropagation();

    setSelectedVehicles((prev) => {
      const current = prev[vehicleId];

      // If vehicle not selected yet, add it
      if (!current) {
        if (action === "increment") {
          return {
            ...prev,
            [vehicleId]: {
              quantity: 1,
              data: {
                vehicle: ownerData.vehicles.find((v) => v._id === vehicleId),
              },
            },
          };
        }
        return prev;
      }

      let newQuantity = current.quantity;

      if (action === "increment") {
        newQuantity += 1;
      } else if (action === "decrement" && newQuantity > 1) {
        newQuantity -= 1;
      } else if (action === "decrement" && newQuantity === 1) {
        // Remove vehicle if quantity becomes 0
        // eslint-disable-next-line no-unused-vars
        const { [vehicleId]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [vehicleId]: {
          ...current,
          quantity: newQuantity,
        },
      };
    });
  };

  // Handle Select All / Deselect All
  const handleSelectAll = () => {
    const filteredVehicles = getFilteredVehicles();
    const allSelected = filteredVehicles.every(
      (vehicle) => selectedVehicles[vehicle._id]?.quantity > 0,
    );

    if (allSelected) {
      // Deselect all filtered vehicles
      setSelectedVehicles((prev) => {
        const newSelected = { ...prev };
        filteredVehicles.forEach((vehicle) => {
          delete newSelected[vehicle._id];
        });
        return newSelected;
      });
    } else {
      // Select all filtered vehicles
      const newSelections = {};
      filteredVehicles.forEach((vehicle) => {
        newSelections[vehicle._id] = {
          quantity: 1,
          data: { vehicle },
        };
      });
      setSelectedVehicles((prev) => ({ ...prev, ...newSelections }));
    }
  };

  // Filter vehicles based on selected filter
  const getFilteredVehicles = () => {
    if (filterType === "ALL") return ownerData.vehicles;
    if (filterType === "PASSENGER")
      return ownerData.vehicles.filter((v) => v.serviceType === "PASSENGER");
    if (filterType === "GOODS")
      return ownerData.vehicles.filter(
        (v) => v.serviceType === "GOODS_CARRIER",
      );
    if (filterType === "MANAGED")
      return ownerData.vehicles.filter(
        (v) => v.serviceType === "MANAGED_SERVICES",
      );
    if (filterType === "WITH_DRIVER")
      return ownerData.vehicles.filter((v) => v.driverAvailability?.withDriver);
    if (filterType === "FUEL_INCLUDED")
      return ownerData.vehicles.filter((v) => v.fuelOptions?.fuelIncluded);
    return ownerData.vehicles;
  };

  // Calculate total monthly cost
  // const calculateTotal = () => {
  //   return Object.values(selectedVehicles).reduce((total, item) => {
  //     return total + (item.data?.pricing?.monthlyRate || 0) * item.quantity;
  //   }, 0);
  // };

  // Get total count of selected vehicles
  const getTotalSelectedCount = () => {
    return Object.values(selectedVehicles).reduce(
      (total, item) => total + item.quantity,
      0,
    );
  };

  // Handle quotation request
  const handleRequestQuotation = () => {
    // Calculate end date based on rental duration type and value
    const calculateEndDate = (startDate, durationType, durationValue) => {
      const start = new Date(startDate);
      const value = parseInt(durationValue);

      const typeLower = durationType.toLowerCase();

      if (typeLower === "monthly" || typeLower === "month") {
        start.setMonth(start.getMonth() + value);
      } else if (typeLower === "weekly" || typeLower === "week") {
        start.setDate(start.getDate() + value * 7);
      } else if (typeLower === "daily" || typeLower === "day") {
        start.setDate(start.getDate() + value);
      } else if (
        typeLower === "long-term" ||
        typeLower === "yearly" ||
        typeLower === "year"
      ) {
        start.setFullYear(start.getFullYear() + value);
      } else {
        // Default to months if not specified
        start.setMonth(start.getMonth() + value);
      }

      return start.toISOString();
    };

    // Determine duration type for schema enum
    const getDurationType = (durationType) => {
      const typeLower = durationType.toLowerCase();
      if (typeLower === "daily" || typeLower === "day") return "DAILY";
      if (typeLower === "weekly" || typeLower === "week") return "WEEKLY";
      if (typeLower === "monthly" || typeLower === "month") return "MONTHLY";
      if (
        typeLower === "long-term" ||
        typeLower === "yearly" ||
        typeLower === "year"
      )
        return "LONG_TERM";
      return "MONTHLY"; // Default
    };

    // Prepare quotation data matching the schema
    // The corporate picked the service type back on the Service Selection
    // screen; it travels here inside userfilters. A "managed" selection means
    // this is a managed-service quotation, so the corporate must be able to
    // hand the partner an operations brief BEFORE the partner prices it.
    const isManaged =
      String(corporateuserrequirements?.serviceType || "").toLowerCase() ===
      "managed";

    const quotationData = {
      // User IDs
      corporateOwnerId: user._id, // Logged-in corporate user
      fleetOwnerId: ownerData.fleetOwnerId, // Fleet owner ID

      // Standard vs managed service. Managed => a Managed Service Brief is
      // created against this quotation so the partner sees the required routes,
      // work locations, shifts and employee roster before quoting.
      serviceMode: isManaged ? "MANAGED" : "STANDARD",

      // Vehicle IDs (array of ObjectIds) - FIXED: Access vehicle._id correctly
      vehicles: Object.values(selectedVehicles).map((item) => ({
        vehicleId: item.data.vehicle?._id || item.data._id,
        quantity: item.quantity,
      })),

      // Rental Period
      rentalPeriod: {
        startDate: corporateuserrequirements.startDate,
        endDate: calculateEndDate(
          corporateuserrequirements.startDate,
          corporateuserrequirements.rentalDuration,
          corporateuserrequirements.durationValue,
        ),
        durationType: getDurationType(corporateuserrequirements.rentalDuration),
        duration: parseInt(corporateuserrequirements.durationValue),
      },

      // Requirements
      requirements: {
        withDriver: corporateuserrequirements.driverRequired,
        fuelIncluded: corporateuserrequirements.fuelIncluded,
      },

      // Status (will default to "REQUESTED" in schema)
      status: "REQUESTED",

      // Optional: Add valid until date (e.g., 7 days from now)
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // For managed services the corporate must author an operations brief (work
    // locations & shifts + the routes to operate) BEFORE the request reaches
    // the partner. Open the brief modal and hold the quotation payload; the two
    // are then submitted together so the partner never sees a request without a
    // brief. Standard requests are submitted straight away.
    if (isManaged) {
      setPendingQuotation(quotationData);
      setShowBriefModal(true);
      return;
    }

    handleQuotationSubmit(quotationData, false);
  };

  // Called from the brief modal: merge the brief into the held quotation payload
  // and submit both in a single atomic request.
  const handleBriefSubmit = async (managedServiceBrief) => {
    if (!pendingQuotation) return;
    setSubmittingRequest(true);
    try {
      await handleQuotationSubmit(
        { ...pendingQuotation, managedServiceBrief },
        true,
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleQuotationSubmit = async (quotationData, isManaged) => {
    try {
      const created = await dispatch(requestQuotation(quotationData)).unwrap();

      // requestQuotation resolves to { quotation, quotationNumber, briefId }.
      const newId =
        created?.quotation?._id || created?.quotation?.id || created?._id;

      setShowBriefModal(false);
      setPendingQuotation(null);

      // For managed services, send the corporate to the quotation they just
      // created (with its submitted brief) so they can review/refine it. Falls
      // back to the quotations list if the id is missing for any reason.
      if (isManaged && newId) {
        navigate(`/quotation/${newId}?brief=1`);
      } else if (newId) {
        navigate("/corporate-profile?tab=my-quotations");
      } else {
        navigate("/corporate-profile?tab=my-quotations");
      }
    } catch (error) {
      console.error("Failed to create quotation:", error);
      // Surface the backend validation message (e.g. missing brief fields).
      alert(
        typeof error === "string"
          ? error
          : error?.message || "Failed to create quotation. Please try again.",
      );
    }
  };

  // Get category label
  const getCategoryLabel = (category) => {
    const labels = {
      COASTER_BUS: "Coaster Bus",
      LUXURY_COACH: "Luxury Coach",
      VOLVO_BUS: "Volvo Bus",
      MINI_BUS: "Mini Bus",
      SEDAN: "Sedan",
      SUV: "SUV",
      TRUCK: "Truck",
      VAN: "Van",
    };
    return labels[category] || category;
  };

  // Check if vehicle is selected
  const isVehicleSelected = (vehicleId) => {
    return !!selectedVehicles[vehicleId];
  };

  const filteredVehicles = getFilteredVehicles();

  return (
    <>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="single-owner-vehicle-container">
        <div className="single-owner-vehicle-header">
          <button
            className="single-owner-vehicle-back-btn"
            onClick={() => window.history.back()}
          >
            ← Back to Results
          </button>
        </div>

        <div className="single-owner-vehicle-owner-card">
          <div className="single-owner-vehicle-owner-header">
            <div className="single-owner-vehicle-owner-info">
              <div className="single-owner-vehicle-owner-title">
                <span className="single-owner-vehicle-icon">🚌</span>
                <h1>{ownerData.fullName}</h1>
                {ownerData.companyName && (
                  <span className="single-owner-vehicle-company-badge">
                    {ownerData.companyName}
                  </span>
                )}
              </div>
              <div className="single-owner-vehicle-rating">
                <span className="single-owner-vehicle-star">⭐</span>
                <span className="single-owner-vehicle-rating-value">
                  {ownerData.rating} ({ownerData.totalReviews})
                </span>
              </div>
            </div>
          </div>

          <div className="single-owner-vehicle-owner-details">
            <div className="single-owner-vehicle-detail-item">
              <span className="single-owner-vehicle-detail-icon">📧</span>
              <span>{ownerData.email}</span>
            </div>
            <div className="single-owner-vehicle-detail-item">
              <span className="single-owner-vehicle-detail-icon">📞</span>
              <span>{ownerData.whatsappNumber}</span>
            </div>
            <div className="single-owner-vehicle-detail-item">
              <span className="single-owner-vehicle-detail-icon">🚗</span>
              <span>{ownerData.totalVehicles} Vehicles Available</span>
            </div>
          </div>

          <div className="single-owner-vehicle-payment-methods">
            <span className="single-owner-vehicle-payment-label">
              Accepted Payments:
            </span>
            {ownerData.acceptedPaymentMethods?.map((method, index) => (
              <span key={index} className="single-owner-vehicle-payment-badge">
                {method}
              </span>
            ))}
          </div>

          <div className="single-owner-vehicle-actions-top">
            <button
              className="single-owner-vehicle-btn-select-all"
              onClick={handleSelectAll}
            >
              {filteredVehicles.every(
                (v) => selectedVehicles[v._id]?.quantity > 0,
              )
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
        </div>

        <div className="single-owner-vehicle-vehicles-section">
          <div className="single-owner-vehicle-section-header">
            <h2>Available Vehicles ({filteredVehicles.length})</h2>
            <div className="single-owner-vehicle-filters">
              <button
                className={`single-owner-vehicle-filter-btn ${
                  filterType === "ALL" ? "active" : ""
                }`}
                onClick={() => setFilterType("ALL")}
              >
                All
              </button>
              <button
                className={`single-owner-vehicle-filter-btn ${
                  filterType === "PASSENGER" ? "active" : ""
                }`}
                onClick={() => setFilterType("PASSENGER")}
              >
                Passenger
              </button>
              <button
                className={`single-owner-vehicle-filter-btn ${
                  filterType === "GOODS" ? "active" : ""
                }`}
                onClick={() => setFilterType("GOODS")}
              >
                Goods
              </button>
              <button
                className={`single-owner-vehicle-filter-btn ${
                  filterType === "WITH_DRIVER" ? "active" : ""
                }`}
                onClick={() => setFilterType("WITH_DRIVER")}
              >
                With Driver
              </button>
              <button
                className={`single-owner-vehicle-filter-btn ${
                  filterType === "FUEL_INCLUDED" ? "active" : ""
                }`}
                onClick={() => setFilterType("FUEL_INCLUDED")}
              >
                Fuel Included
              </button>
            </div>
          </div>

          <div className="single-owner-vehicle-vehicles-grid">
            {filteredVehicles.map((vehicle, index) => (
              <div
                key={vehicle._id}
                className="single-owner-vehicle-card"
                onClick={() =>
                  handleCardClick(vehicle, corporateuserrequirements)
                }
                style={{
                  borderColor: isVehicleSelected(vehicle._id)
                    ? "#667eea"
                    : "#e2e8f0",
                  borderWidth: isVehicleSelected(vehicle._id) ? "3px" : "2px",
                  cursor: "pointer",
                }}
              >
                <div className="single-owner-vehicle-card-header">
                  <h3>
                    #{index + 1} {vehicle.vehicleName} -{" "}
                    {getCategoryLabel(vehicle.vehicleCategory)}
                  </h3>
                  <div className="single-owner-vehicle-quantity-controls">
                    <button
                      className="single-owner-vehicle-qty-btn"
                      onClick={(e) =>
                        handleQuantityChange(vehicle._id, "decrement", e)
                      }
                      disabled={!selectedVehicles[vehicle._id]?.quantity}
                    >
                      −
                    </button>
                    <span className="single-owner-vehicle-qty-value">
                      {selectedVehicles[vehicle._id]?.quantity || 0}
                    </span>
                    <button
                      className="single-owner-vehicle-qty-btn"
                      onClick={(e) =>
                        handleQuantityChange(vehicle._id, "increment", e)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                {vehicle.photos && vehicle.photos.length > 0 && (
                  <div className="single-owner-vehicle-image-gallery">
                    <img
                      src={vehicle.photos[0].url}
                      alt={vehicle.vehicleName}
                      className="single-owner-vehicle-main-image"
                    />
                    <div className="single-owner-vehicle-gallery-count">
                      📷 {vehicle.photos.length} photos
                    </div>
                  </div>
                )}

                <div className="single-owner-vehicle-details-section">
                  <div className="single-owner-vehicle-detail-row">
                    <span className="single-owner-vehicle-label">
                      Category:
                    </span>
                    <span className="single-owner-vehicle-value">
                      {getCategoryLabel(vehicle.vehicleCategory)}
                    </span>
                  </div>
                  <div className="single-owner-vehicle-detail-row">
                    <span className="single-owner-vehicle-label">
                      Service Type:
                    </span>
                    <span className="single-owner-vehicle-value">
                      <span
                        className={`single-owner-vehicle-badge ${vehicle.serviceType.toLowerCase()}`}
                      >
                        {vehicle.serviceType}
                      </span>
                    </span>
                  </div>
                  <div className="single-owner-vehicle-detail-row">
                    <span className="single-owner-vehicle-label">
                      Location:
                    </span>
                    <span className="single-owner-vehicle-value">
                      📍 {vehicle.location}
                    </span>
                  </div>
                  <div className="single-owner-vehicle-detail-row">
                    <span className="single-owner-vehicle-label">
                      Capacity:
                    </span>
                    <span className="single-owner-vehicle-value">
                      {vehicle.capacity.seatingCapacity > 0 &&
                        `${vehicle.capacity.seatingCapacity} Seats`}
                      {vehicle.capacity.cargoCapacity > 0 &&
                        ` | ${vehicle.capacity.cargoCapacity} Cargo`}
                    </span>
                  </div>
                </div>

                <div className="single-owner-vehicle-options">
                  <h4>Available With</h4>
                  <div className="single-owner-vehicle-options-grid">
                    {corporateuserrequirements.driverRequired ? (
                      <span className="single-owner-vehicle-option-badge">
                        👨‍✈️ With Driver
                      </span>
                    ) : (
                      <span className="single-owner-vehicle-option-badge">
                        👨‍✈️ Without Driver
                      </span>
                    )}

                    {corporateuserrequirements.fuelIncluded ? (
                      <span className="single-owner-vehicle-option-badge">
                        ⛽ Fuel Included
                      </span>
                    ) : (
                      <span className="single-owner-vehicle-option-badge">
                        ⛽ Without Fuel
                      </span>
                    )}
                  </div>
                </div>

                <div className="single-owner-vehicle-facilities">
                  <h4>Facilities</h4>
                  <div className="single-owner-vehicle-facilities-grid">
                    {corporateuserrequirements?.features?.map(
                      (feature, index) => (
                        <div
                          key={index}
                          className="single-owner-vehicle-facility"
                        >
                          {feature}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="single-owner-vehicle-pricing">
                  <div className="single-owner-vehicle-pricing-grid">
                    <div className="single-owner-vehicle-price-item">
                      <span className="single-owner-vehicle-price-label">
                        Start Date
                      </span>
                      <span className="single-owner-vehicle-price-value">
                        {corporateuserrequirements.startDate}
                      </span>
                    </div>
                    <div className="single-owner-vehicle-price-item">
                      <span className="single-owner-vehicle-price-label">
                        Rental Duration
                      </span>
                      <span className="single-owner-vehicle-price-value">
                        {corporateuserrequirements.rentalDuration ===
                        "long-term"
                          ? "long-term"
                          : corporateuserrequirements.rentalDuration}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {getTotalSelectedCount() > 0 && (
          <div className="single-owner-vehicle-footer">
            <div className="single-owner-vehicle-footer-content">
              <div className="single-owner-vehicle-footer-summary">
                <div className="single-owner-vehicle-summary-item">
                  <span className="single-owner-vehicle-summary-label">
                    Selected:
                  </span>
                  <span className="single-owner-vehicle-summary-value">
                    {getTotalSelectedCount()} vehicles
                  </span>
                </div>
              </div>
              <button
                className="single-owner-vehicle-btn-quotation"
                onClick={handleRequestQuotation}
              >
                Request Quotation for Selected ({getTotalSelectedCount()})
              </button>
            </div>
          </div>
        )}
      </div>

      {showBriefModal && (
        <ManagedServiceBriefModal
          fleetOwnerName={
            ownerData.companyName || ownerData.fullName || "the partner"
          }
          defaultServiceStartDate={corporateuserrequirements.startDate || ""}
          submitting={submittingRequest}
          onSubmit={handleBriefSubmit}
          onClose={() => {
            if (submittingRequest) return;
            setShowBriefModal(false);
            setPendingQuotation(null);
          }}
        />
      )}

      <Footer />
    </>
  );
};

export default SingleVehicleOwnerDetails;
