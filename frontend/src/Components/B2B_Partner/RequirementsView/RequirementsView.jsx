import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./RequirementsView.css";

function RequirementsView() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showQuotationModal, setShowQuotationModal] = useState(false);

  // Quotation form state
  const [quotationForm, setQuotationForm] = useState({
    requirementId: "",
    vehicleType: "",
    vehicleDetails: {
      make: "",
      model: "",
      year: "",
      seatingCapacity: "",
      features: [],
      images: []
    },
    pricing: {
      monthlyRate: 0,
      currency: "KWD",
      driverIncluded: true,
      fuelIncluded: true,
      additionalCharges: []
    },
    terms: {
      paymentTerms: "MONTHLY",
      contractDuration: 12,
      noticePeriod: 30,
      maintenanceIncluded: true,
      insuranceIncluded: true
    },
    availability: {
      availableFrom: "",
      availableVehicles: 1,
      driverDetails: {
        name: "",
        licenseNumber: "",
        experience: "",
        languages: []
      }
    },
    message: "",
    validUntil: ""
  });

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/requirements/open', {
        params: {
          page: currentPage,
          limit: 10,
          search: searchTerm || undefined,
          vehicleType: filterVehicleType || undefined,
          location: filterLocation || undefined
        }
      });
      setRequirements(response.data.data.requirements);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error) {
      console.error("Error fetching requirements:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filterVehicleType, filterLocation]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const handleCreateQuotation = (requirement) => {
    setSelectedRequirement(requirement);
    
    // Pre-fill form with requirement data
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setQuotationForm({
      ...quotationForm,
      requirementId: requirement._id,
      vehicleType: requirement.vehicleRequirements[0]?.vehicleType || "BUS",
      pricing: {
        ...quotationForm.pricing,
        currency: requirement.contractDetails.budgetRange.currency
      },
      terms: {
        ...quotationForm.terms,
        contractDuration: requirement.contractDetails.duration
      },
      availability: {
        ...quotationForm.availability,
        availableFrom: requirement.contractDetails.startDate
      },
      validUntil: requirement.quotationDeadline
    });
    
    setShowQuotationModal(true);
  };

  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Build the payload matching the backend endpoint
      const payload = {
        vehicleOfferings: [{
          vehicleType: quotationForm.vehicleType,
          quantity: quotationForm.availability.availableVehicles,
          make: quotationForm.vehicleDetails.make,
          model: quotationForm.vehicleDetails.model,
          year: quotationForm.vehicleDetails.year,
          seatingCapacity: quotationForm.vehicleDetails.seatingCapacity,
          features: quotationForm.vehicleDetails.features
        }],
        pricing: {
          monthlyRate: quotationForm.pricing.monthlyRate,
          totalAmount: quotationForm.pricing.monthlyRate * (quotationForm.terms.contractDuration || 1),
          currency: quotationForm.pricing.currency,
          vehicleRental: quotationForm.pricing.monthlyRate,
          driverCharges: quotationForm.pricing.driverIncluded ? 0 : 0,
          fuelCharges: quotationForm.pricing.fuelIncluded ? 0 : 0,
          perVehicleBreakdown: []
        },
        terms: {
          paymentTerms: quotationForm.terms.paymentTerms,
          contractDuration: quotationForm.terms.contractDuration,
          noticePeriod: quotationForm.terms.noticePeriod,
          maintenanceIncluded: quotationForm.terms.maintenanceIncluded,
          insuranceIncluded: quotationForm.terms.insuranceIncluded,
          notes: `Payment: ${quotationForm.terms.paymentTerms}, Notice: ${quotationForm.terms.noticePeriod} days, Maintenance: ${quotationForm.terms.maintenanceIncluded ? 'Included' : 'Not included'}, Insurance: ${quotationForm.terms.insuranceIncluded ? 'Included' : 'Not included'}`
        },
        availability: quotationForm.availability,
        message: quotationForm.message,
        validUntil: quotationForm.validUntil
      };

      await api.post(`/requirements/${quotationForm.requirementId}/submit-quotation`, payload);
      setShowQuotationModal(false);
      resetQuotationForm();
      fetchRequirements();
      alert("Quotation submitted successfully!");
    } catch (error) {
      console.error("Error submitting quotation:", error);
      alert(error.response?.data?.message || "Failed to submit quotation");
    } finally {
      setLoading(false);
    }
  };

  const resetQuotationForm = () => {
    setQuotationForm({
      requirementId: "",
      vehicleType: "",
      vehicleDetails: {
        make: "",
        model: "",
        year: "",
        seatingCapacity: "",
        features: [],
        images: []
      },
      pricing: {
        monthlyRate: 0,
        currency: "KWD",
        driverIncluded: true,
        fuelIncluded: true,
        additionalCharges: []
      },
      terms: {
        paymentTerms: "MONTHLY",
        contractDuration: 12,
        noticePeriod: 30,
        maintenanceIncluded: true,
        insuranceIncluded: true
      },
      availability: {
        availableFrom: "",
        availableVehicles: 1,
        driverDetails: {
          name: "",
          licenseNumber: "",
          experience: "",
          languages: []
        }
      },
      message: "",
      validUntil: ""
    });
  };

  const getDaysUntilDeadline = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDeadlineColor = (days) => {
    if (days <= 3) return "#ef4444"; // Red - Urgent
    if (days <= 7) return "#f59e0b"; // Yellow - Soon
    return "#10b981"; // Green - Plenty of time
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "LOW": return "#10b981";
      case "MEDIUM": return "#f59e0b";
      case "HIGH": return "#ef4444";
      case "URGENT": return "#dc2626";
      default: return "#6b7280";
    }
  };

  const addFeature = (feature) => {
    if (!quotationForm.vehicleDetails.features.includes(feature)) {
      setQuotationForm(prev => ({
        ...prev,
        vehicleDetails: {
          ...prev.vehicleDetails,
          features: [...prev.vehicleDetails.features, feature]
        }
      }));
    }
  };

  const removeFeature = (feature) => {
    setQuotationForm(prev => ({
      ...prev,
      vehicleDetails: {
        ...prev.vehicleDetails,
        features: prev.vehicleDetails.features.filter(f => f !== feature)
      }
    }));
  };

  const addLanguage = (language) => {
    if (!quotationForm.availability.driverDetails.languages.includes(language)) {
      setQuotationForm(prev => ({
        ...prev,
        availability: {
          ...prev.availability,
          driverDetails: {
            ...prev.availability.driverDetails,
            languages: [...prev.availability.driverDetails.languages, language]
          }
        }
      }));
    }
  };

  const removeLanguage = (language) => {
    setQuotationForm(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        driverDetails: {
          ...prev.availability.driverDetails,
          languages: prev.availability.driverDetails.languages.filter(l => l !== language)
        }
      }
    }));
  };

  if (loading && requirements.length === 0) {
    return (
      <div className="requirements-view">
        <div className="loading">Loading requirements...</div>
      </div>
    );
  }

  return (
    <div className="b2bpartner-RequirementsTab-requirements-view">
      <div className="b2bpartner-RequirementsTab-view-header">
        <h2>Open Requirements</h2>
        <p>
          Find and quote on transportation requirements from corporate clients
        </p>
      </div>

      {/* Filters */}
      <div className="b2bpartner-RequirementsTab-filters-section">
        <div className="b2bpartner-RequirementsTab-filter-row">
          <input
            type="text"
            placeholder="Search requirements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="b2bpartner-RequirementsTab-search-input"
          />
          <select
            value={filterVehicleType}
            onChange={(e) => setFilterVehicleType(e.target.value)}
            className="b2bpartner-RequirementsTab-filter-select"
          >
            <option value="">All Vehicle Types</option>
            <option value="BUS">Bus</option>
            <option value="VAN">Van</option>
            <option value="MINIBUS">Minibus</option>
            <option value="SEDAN">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="TRUCK">Truck</option>
          </select>
          <input
            type="text"
            placeholder="Filter by location..."
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="b2bpartner-RequirementsTab-filter-input"
          />
        </div>
      </div>

      {/* Requirements List */}
      <div className="b2bpartner-RequirementsTab-requirements-list">
        {requirements.length === 0 ? (
          <div className="b2bpartner-RequirementsTab-no-requirements">
            <div className="b2bpartner-RequirementsTab-no-requirements-icon">
              📋
            </div>
            <h3>No Open Requirements Found</h3>
            <p>
              Try adjusting your filters or check back later for new
              requirements.
            </p>
          </div>
        ) : (
          <div className="b2bpartner-RequirementsTab-requirements-grid">
            {requirements.map((requirement) => {
              const daysUntilDeadline = getDaysUntilDeadline(
                requirement.quotationDeadline,
              );

              return (
                <div
                  key={requirement._id}
                  className="b2bpartner-RequirementsTab-requirement-card"
                >
                  <div className="b2bpartner-RequirementsTab-card-header">
                    <div className="b2bpartner-RequirementsTab-requirement-title">
                      <h3>{requirement.title}</h3>
                      <div
                        className="b2bpartner-RequirementsTab-priority-badge"
                        style={{
                          backgroundColor: getPriorityColor(
                            requirement.priority,
                          ),
                        }}
                      >
                        {requirement.priority}
                      </div>
                    </div>
                    <div className="b2bpartner-RequirementsTab-corporate-info">
                      <img
                        src={
                          requirement.corporateId.companyLogo ||
                          "/default-company.png"
                        }
                        alt={requirement.corporateId.companyName}
                        className="b2bpartner-RequirementsTab-company-logo"
                      />
                      <span className="b2bpartner-RequirementsTab-company-name">
                        {requirement.corporateId.companyName}
                      </span>
                    </div>
                  </div>

                  <div className="b2bpartner-RequirementsTab-card-body">
                    <p className="b2bpartner-RequirementsTab-description">
                      {requirement.description}
                    </p>

                    <div className="b2bpartner-RequirementsTab-route-info">
                      <div className="b2bpartner-RequirementsTab-route-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Route:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.routeInfo.fromLocation} →{" "}
                          {requirement.routeInfo.toLocation}
                        </span>
                      </div>
                      <div className="b2bpartner-RequirementsTab-route-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Distance:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.routeInfo.estimatedDistance} km
                        </span>
                      </div>
                      <div className="b2bpartner-RequirementsTab-route-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Duration:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.routeInfo.estimatedDuration}
                        </span>
                      </div>
                    </div>

                    <div className="b2bpartner-RequirementsTab-vehicle-requirements">
                      <h4>Vehicle Requirements:</h4>
                      {requirement.vehicleRequirements.map((vehicle, index) => (
                        <div
                          key={index}
                          className="b2bpartner-RequirementsTab-vehicle-item"
                        >
                          <span className="b2bpartner-RequirementsTab-vehicle-type">
                            {vehicle.quantity}x {vehicle.vehicleType}
                          </span>
                          <span className="b2bpartner-RequirementsTab-vehicle-capacity">
                            ({vehicle.capacity} seats)
                          </span>
                          {vehicle.features.length > 0 && (
                            <div className="b2bpartner-RequirementsTab-features">
                              {vehicle.features
                                .slice(0, 3)
                                .map((feature, idx) => (
                                  <span
                                    key={idx}
                                    className="b2bpartner-RequirementsTab-feature-tag"
                                  >
                                    {feature}
                                  </span>
                                ))}
                              {vehicle.features.length > 3 && (
                                <span className="b2bpartner-RequirementsTab-feature-more">
                                  +{vehicle.features.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="b2bpartner-RequirementsTab-budget-info">
                      <div className="b2bpartner-RequirementsTab-budget-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Budget Range:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value b2bpartner-RequirementsTab-budget">
                          {requirement.contractDetails.budgetRange.min} -{" "}
                          {requirement.contractDetails.budgetRange.max}{" "}
                          {requirement.contractDetails.budgetRange.currency}
                        </span>
                      </div>
                      <div className="b2bpartner-RequirementsTab-budget-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Duration:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.contractDetails.duration} months
                        </span>
                      </div>
                    </div>

                    <div className="b2bpartner-RequirementsTab-schedule-info">
                      <div className="b2bpartner-RequirementsTab-schedule-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Service:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.scheduleRequirements.serviceType}
                        </span>
                      </div>
                      <div className="b2bpartner-RequirementsTab-schedule-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Days:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.scheduleRequirements.operatingDays.join(
                            ", ",
                          )}
                        </span>
                      </div>
                      <div className="b2bpartner-RequirementsTab-schedule-item">
                        <span className="b2bpartner-RequirementsTab-label">
                          Time:
                        </span>
                        <span className="b2bpartner-RequirementsTab-value">
                          {requirement.scheduleRequirements.startTime} -{" "}
                          {requirement.scheduleRequirements.endTime}
                        </span>
                      </div>
                    </div>

                    {requirement.tags.length > 0 && (
                      <div className="b2bpartner-RequirementsTab-tags">
                        {requirement.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="b2bpartner-RequirementsTab-tag"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="b2bpartner-RequirementsTab-card-footer">
                    <div className="b2bpartner-RequirementsTab-deadline-info">
                      <span className="b2bpartner-RequirementsTab-deadline-label">
                        Deadline:
                      </span>
                      <span
                        className="b2bpartner-RequirementsTab-deadline-value"
                        style={{ color: getDeadlineColor(daysUntilDeadline) }}
                      >
                        {new Date(
                          requirement.quotationDeadline,
                        ).toLocaleDateString()}{" "}
                        ({daysUntilDeadline} days left)
                      </span>
                    </div>
                    <div className="b2bpartner-RequirementsTab-action-buttons">
                      <button
                        className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-outline"
                        onClick={() => setSelectedRequirement(requirement)}
                      >
                        View Details
                      </button>
                      <button
                        className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-primary"
                        onClick={() => handleCreateQuotation(requirement)}
                      >
                        Send Quotation
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="b2bpartner-RequirementsTab-pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Quotation Modal */}
      {showQuotationModal && selectedRequirement && (
        <div className="b2bpartner-RequirementsTab-modal-overlay">
          <div className="b2bpartner-RequirementsTab-modal large-modal">
            <div className="b2bpartner-RequirementsTab-modal-header">
              <h3>Send Quotation</h3>
              <div className="b2bpartner-RequirementsTab-requirement-summary">
                <h4>{selectedRequirement.title}</h4>
                <p>{selectedRequirement.corporateId.companyName}</p>
                <p>
                  Budget: {selectedRequirement.contractDetails.budgetRange.min}{" "}
                  - {selectedRequirement.contractDetails.budgetRange.max}{" "}
                  {selectedRequirement.contractDetails.budgetRange.currency}
                </p>
              </div>
              <button
                className="b2bpartner-RequirementsTab-close-btn"
                onClick={() => setShowQuotationModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitQuotation} className="modal-form">
              <div className="b2bpartner-RequirementsTab-form-section">
                <h4>Vehicle Details</h4>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <select
                    value={quotationForm.vehicleType}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        vehicleType: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select Vehicle Type</option>
                    <option value="BUS">Bus</option>
                    <option value="VAN">Van</option>
                    <option value="MINIBUS">Minibus</option>
                    <option value="SEDAN">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="TRUCK">Truck</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Vehicle Make"
                    value={quotationForm.vehicleDetails.make}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        vehicleDetails: {
                          ...prev.vehicleDetails,
                          make: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Vehicle Model"
                    value={quotationForm.vehicleDetails.model}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        vehicleDetails: {
                          ...prev.vehicleDetails,
                          model: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <input
                    type="number"
                    placeholder="Year"
                    value={quotationForm.vehicleDetails.year}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        vehicleDetails: {
                          ...prev.vehicleDetails,
                          year: e.target.value,
                        },
                      }))
                    }
                    min="2000"
                    max={new Date().getFullYear()}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Seating Capacity"
                    value={quotationForm.vehicleDetails.seatingCapacity}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        vehicleDetails: {
                          ...prev.vehicleDetails,
                          seatingCapacity: e.target.value,
                        },
                      }))
                    }
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Available Vehicles"
                    value={quotationForm.availability.availableVehicles}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          availableVehicles: parseInt(e.target.value),
                        },
                      }))
                    }
                    min="1"
                    required
                  />
                </div>
                <div className="b2bpartner-RequirementsTab-form-group">
                  <label>Vehicle Features</label>
                  <div className="features-selection">
                    {[
                      "AC",
                      "NON_AC",
                      "GPS",
                      "CAMERA",
                      "USB_CHARGING",
                      "WIFI",
                      "ENTERTAINMENT",
                      "DISABLED_ACCESS",
                    ].map((feature) => (
                      <label
                        key={feature}
                        className="b2bpartner-RequirementsTab-feature-checkbox"
                      >
                        <input
                          type="checkbox"
                          checked={quotationForm.vehicleDetails.features.includes(
                            feature,
                          )}
                          onChange={() => {
                            if (
                              quotationForm.vehicleDetails.features.includes(
                                feature,
                              )
                            ) {
                              removeFeature(feature);
                            } else {
                              addFeature(feature);
                            }
                          }}
                        />
                        <span>{feature.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-form-section">
                <h4>Pricing</h4>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <input
                    type="number"
                    placeholder="Monthly Rate"
                    value={quotationForm.pricing.monthlyRate}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          monthlyRate: parseFloat(e.target.value),
                        },
                      }))
                    }
                    min="0"
                    step="0.01"
                    required
                  />
                  <select
                    value={quotationForm.pricing.currency}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, currency: e.target.value },
                      }))
                    }
                  >
                    <option value="KWD">KWD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <label className="b2bpartner-RequirementsTab-checkbox-label">
                    <input
                      type="checkbox"
                      checked={quotationForm.pricing.driverIncluded}
                      onChange={(e) =>
                        setQuotationForm((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing,
                            driverIncluded: e.target.checked,
                          },
                        }))
                      }
                    />
                    Driver Included
                  </label>
                  <label className="b2bpartner-RequirementsTab-checkbox-label">
                    <input
                      type="checkbox"
                      checked={quotationForm.pricing.fuelIncluded}
                      onChange={(e) =>
                        setQuotationForm((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing,
                            fuelIncluded: e.target.checked,
                          },
                        }))
                      }
                    />
                    Fuel Included
                  </label>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-form-section">
                <h4>Driver Details</h4>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <input
                    type="text"
                    placeholder="Driver Name"
                    value={quotationForm.availability.driverDetails.name}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          driverDetails: {
                            ...prev.availability.driverDetails,
                            name: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="License Number"
                    value={
                      quotationForm.availability.driverDetails.licenseNumber
                    }
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          driverDetails: {
                            ...prev.availability.driverDetails,
                            licenseNumber: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Experience (years)"
                    value={quotationForm.availability.driverDetails.experience}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          driverDetails: {
                            ...prev.availability.driverDetails,
                            experience: e.target.value,
                          },
                        },
                      }))
                    }
                    min="0"
                  />
                </div>
                <div className="b2bpartner-RequirementsTab-form-group">
                  <label>Languages</label>
                  <div className="b2bpartner-RequirementsTab-languages-selection">
                    {[
                      "ENGLISH",
                      "ARABIC",
                      "HINDI",
                      "URDU",
                      "FRENCH",
                      "SPANISH",
                    ].map((language) => (
                      <label
                        key={language}
                        className="b2bpartner-RequirementsTab-language-checkbox"
                      >
                        <input
                          type="checkbox"
                          checked={quotationForm.availability.driverDetails.languages.includes(
                            language,
                          )}
                          onChange={() => {
                            if (
                              quotationForm.availability.driverDetails.languages.includes(
                                language,
                              )
                            ) {
                              removeLanguage(language);
                            } else {
                              addLanguage(language);
                            }
                          }}
                        />
                        <span>{language}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-form-section">
                <h4>Terms & Conditions</h4>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <select
                    value={quotationForm.terms.paymentTerms}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        terms: { ...prev.terms, paymentTerms: e.target.value },
                      }))
                    }
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUALLY">Annually</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Contract Duration (months)"
                    value={quotationForm.terms.contractDuration}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        terms: {
                          ...prev.terms,
                          contractDuration: parseInt(e.target.value),
                        },
                      }))
                    }
                    min="1"
                  />
                  <input
                    type="number"
                    placeholder="Notice Period (days)"
                    value={quotationForm.terms.noticePeriod}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        terms: {
                          ...prev.terms,
                          noticePeriod: parseInt(e.target.value),
                        },
                      }))
                    }
                    min="1"
                  />
                </div>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <label className="b2bpartner-RequirementsTab-checkbox-label">
                    <input
                      type="checkbox"
                      checked={quotationForm.terms.maintenanceIncluded}
                      onChange={(e) =>
                        setQuotationForm((prev) => ({
                          ...prev,
                          terms: {
                            ...prev.terms,
                            maintenanceIncluded: e.target.checked,
                          },
                        }))
                      }
                    />
                    Maintenance Included
                  </label>
                  <label className="b2bpartner-RequirementsTab-checkbox-label">
                    <input
                      type="checkbox"
                      checked={quotationForm.terms.insuranceIncluded}
                      onChange={(e) =>
                        setQuotationForm((prev) => ({
                          ...prev,
                          terms: {
                            ...prev.terms,
                            insuranceIncluded: e.target.checked,
                          },
                        }))
                      }
                    />
                    Insurance Included
                  </label>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-form-section">
                <h4>Additional Information</h4>
                <div className="b2bpartner-RequirementsTab-form-row">
                  <input
                    type="date"
                    placeholder="Available From"
                    value={quotationForm.availability.availableFrom}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          availableFrom: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                  <input
                    type="date"
                    placeholder="Quotation Valid Until"
                    value={quotationForm.validUntil}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        validUntil: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="b2bpartner-RequirementsTab-form-group">
                  <textarea
                    placeholder="Additional message or special notes..."
                    value={quotationForm.message}
                    onChange={(e) =>
                      setQuotationForm((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    rows={4}
                  />
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-modal-actions">
                <button
                  type="button"
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-secondary"
                  onClick={() => setShowQuotationModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Send Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requirement Details Modal */}
      {selectedRequirement && !showQuotationModal && (
        <div className="b2bpartner-RequirementsTab-modal-overlay">
          <div className="b2bpartner-RequirementsTab-modal">
            <div className="b2bpartner-RequirementsTab-modal-header">
              <h3>Requirement Details</h3>
              <button
                className="b2bpartner-RequirementsTab-close-btn"
                onClick={() => setSelectedRequirement(null)}
              >
                ×
              </button>
            </div>
            <div className="b2bpartner-RequirementsTab-modal-content b2bpartner-RequirementsTab-requirement-details">
              <div className="b2bpartner-RequirementsTab-detail-section">
                <h4>Basic Information</h4>
                <div className="b2bpartner-RequirementsTab-detail-grid">
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Title:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.title}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Priority:
                    </span>
                    <span
                      className="b2bpartner-RequirementsTab-value b2bpartner-RequirementsTab-priority-badge"
                      style={{
                        backgroundColor: getPriorityColor(
                          selectedRequirement.priority,
                        ),
                      }}
                    >
                      {selectedRequirement.priority}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Status:
                    </span>
                    <span
                      className="b2bpartner-RequirementsTab-value b2bpartner-RequirementsTab-status-badge"
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      {selectedRequirement.status}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Deadline:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {new Date(
                        selectedRequirement.quotationDeadline,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="b2bpartner-RequirementsTab-description">
                  {selectedRequirement.description}
                </p>
              </div>

              <div className="b2bpartner-RequirementsTab-detail-section">
                <h4>Route Information</h4>
                <div className="b2bpartner-RequirementsTab-detail-grid">
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      From:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.routeInfo.fromLocation}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      To:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.routeInfo.toLocation}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Distance:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.routeInfo.estimatedDistance} km
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Duration:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.routeInfo.estimatedDuration}
                    </span>
                  </div>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-detail-section">
                <h4>Vehicle Requirements</h4>
                {selectedRequirement.vehicleRequirements.map(
                  (vehicle, index) => (
                    <div
                      key={index}
                      className="b2bpartner-RequirementsTab-vehicle-detail-card"
                    >
                      <div className="b2bpartner-RequirementsTab-detail-grid">
                        <div className="b2bpartner-RequirementsTab-detail-item">
                          <span className="b2bpartner-RequirementsTab-label">
                            Type:
                          </span>
                          <span className="b2bpartner-RequirementsTab-value">
                            {vehicle.vehicleType}
                          </span>
                        </div>
                        <div className="b2bpartner-RequirementsTab-detail-item">
                          <span className="b2bpartner-RequirementsTab-label">
                            Quantity:
                          </span>
                          <span className="b2bpartner-RequirementsTab-value">
                            {vehicle.quantity}
                          </span>
                        </div>
                        <div className="b2bpartner-RequirementsTab-detail-item">
                          <span className="b2bpartner-RequirementsTab-label">
                            Capacity:
                          </span>
                          <span className="b2bpartner-RequirementsTab-value">
                            {vehicle.capacity} seats
                          </span>
                        </div>
                        <div className="b2bpartner-RequirementsTab-detail-item">
                          <span className="b2bpartner-RequirementsTab-label">
                            Max Age:
                          </span>
                          <span className="b2bpartner-RequirementsTab-value">
                            {vehicle.ageLimit} years
                          </span>
                        </div>
                      </div>
                      {vehicle.features.length > 0 && (
                        <div className="b2bpartner-RequirementsTab-features-list">
                          <span className="b2bpartner-RequirementsTab-label">
                            Features:
                          </span>
                          <div className="b2bpartner-RequirementsTab-features-tags">
                            {vehicle.features.map((feature, idx) => (
                              <span
                                key={idx}
                                className="b2bpartner-RequirementsTab-feature-tag"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              <div className="b2bpartner-RequirementsTab-detail-section">
                <h4>Contract Details</h4>
                <div className="b2bpartner-RequirementsTab-detail-grid">
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Duration:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.contractDetails.duration} months
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Start Date:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {new Date(
                        selectedRequirement.contractDetails.startDate,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      End Date:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {new Date(
                        selectedRequirement.contractDetails.endDate,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Budget Range:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.contractDetails.budgetRange.min} -{" "}
                      {selectedRequirement.contractDetails.budgetRange.max}{" "}
                      {selectedRequirement.contractDetails.budgetRange.currency}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Payment Terms:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.contractDetails.paymentTerms}
                    </span>
                  </div>
                </div>
              </div>

              <div className="b2bpartner-RequirementsTab-detail-section">
                <h4>Driver Requirements</h4>
                <div className="b2bpartner-RequirementsTab-detail-grid">
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Required:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.driverRequirements.required
                        ? "Yes"
                        : "No"}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      License Type:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.driverRequirements.licenseType}
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Experience:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.driverRequirements.experience} years
                    </span>
                  </div>
                  <div className="b2bpartner-RequirementsTab-detail-item">
                    <span className="b2bpartner-RequirementsTab-label">
                      Background Check:
                    </span>
                    <span className="b2bpartner-RequirementsTab-value">
                      {selectedRequirement.driverRequirements.backgroundCheck
                        ? "Required"
                        : "Not Required"}
                    </span>
                  </div>
                </div>
                {selectedRequirement.driverRequirements.languages.length >
                  0 && (
                  <div className="b2bpartner-RequirementsTab-languages-list">
                    <span className="b2bpartner-RequirementsTab-label">
                      Languages:
                    </span>
                    <div className="b2bpartner-RequirementsTab-languages-tags">
                      {selectedRequirement.driverRequirements.languages.map(
                        (language, idx) => (
                          <span
                            key={idx}
                            className="b2bpartner-RequirementsTab-language-tag"
                          >
                            {language}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="b2bpartner-RequirementsTab-modal-actions">
                <button
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-secondary"
                  onClick={() => setSelectedRequirement(null)}
                >
                  Close
                </button>
                <button
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-primary"
                  onClick={() => {
                    setSelectedRequirement(null);
                    handleCreateQuotation(selectedRequirement);
                  }}
                >
                  Send Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequirementsView;
