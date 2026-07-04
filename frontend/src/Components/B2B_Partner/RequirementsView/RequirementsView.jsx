import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import api from "../../../utils/api";
import "./RequirementsView.css";

// Helper component for company logo with fallback
const CompanyLogo = ({ logo, name, size = 40 }) => {
  const [imgError, setImgError] = useState(false);

  if (!logo || imgError) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "8px",
          backgroundColor: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${size * 0.4}px`,
          fontWeight: "600",
          color: "#64748b",
          flexShrink: 0,
        }}
      >
        {(name || "C").charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={name || "Company"}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "8px",
        objectFit: "cover",
        flexShrink: 0,
      }}
      onError={() => setImgError(true)}
    />
  );
};

function RequirementsView() {
  const auth = useSelector((state) => state.auth);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseForm, setResponseForm] = useState({
    responseType: "INTERESTED", // INTERESTED, NOT_INTERESTED, WILL_ADD_VEHICLE
    message: "",
    estimatedAvailability: "",
    vehicleDetails: "",
  });
  const [activeTab, setActiveTab] = useState("open"); // "open" or "my-responses"
  const [myResponses, setMyResponses] = useState([]);
  const [loadingMyResponses, setLoadingMyResponses] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyingVehicle, setNotifyingVehicle] = useState(false);
  const [selectedResponseForNotify, setSelectedResponseForNotify] =
    useState(null);
  const [notifyMessage, setNotifyMessage] = useState("");

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
      images: [],
    },
    pricing: {
      monthlyRate: 0,
      currency: getActiveCurrency(),
      driverIncluded: true,
      fuelIncluded: true,
      additionalCharges: [],
    },
    terms: {
      paymentTerms: "MONTHLY",
      contractDuration: 12,
      noticePeriod: 30,
      maintenanceIncluded: true,
      insuranceIncluded: true,
    },
    availability: {
      availableFrom: "",
      availableVehicles: 1,
      driverDetails: {
        name: "",
        licenseNumber: "",
        experience: "",
        languages: [],
      },
    },
    message: "",
    validUntil: "",
  });

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/requirements/open", {
        params: {
          page: currentPage,
          limit: 10,
          search: searchTerm || undefined,
          vehicleType: filterVehicleType || undefined,
          location: filterLocation || undefined,
        },
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
        currency: requirement.contractDetails.budgetRange.currency,
      },
      terms: {
        ...quotationForm.terms,
        contractDuration: requirement.contractDetails.duration,
      },
      availability: {
        ...quotationForm.availability,
        availableFrom: requirement.contractDetails.startDate,
      },
      validUntil: requirement.quotationDeadline,
    });

    setShowQuotationModal(true);
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
      case "LOW":
        return "#10b981";
      case "MEDIUM":
        return "#f59e0b";
      case "HIGH":
        return "#ef4444";
      case "URGENT":
        return "#dc2626";
      default:
        return "#6b7280";
    }
  };

  const handleOpenResponseModal = (requirement) => {
    setSelectedRequirement(requirement);
    setResponseForm({
      responseType: "INTERESTED",
      message: "",
      estimatedAvailability: "",
      vehicleDetails: "",
    });
    setShowResponseModal(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedRequirement) return;

    try {
      setSubmittingResponse(true);
      const response = await api.post(
        `/requirements/${selectedRequirement._id}/respond`,
        {
          responseType: responseForm.responseType,
          message: responseForm.message,
          estimatedAvailability: responseForm.estimatedAvailability,
          vehicleDetails: responseForm.vehicleDetails,
        },
      );

      if (response.data.success) {
        toast.success("Response submitted successfully!");
        setShowResponseModal(false);
        setSelectedRequirement(null);
        fetchRequirements(); // Refresh list
        fetchMyResponses(); // Also refresh my responses
      }
    } catch (error) {
      console.error("Error submitting response:", error);
      toast.error(error.response?.data?.message || "Failed to submit response");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const fetchMyResponses = useCallback(async () => {
    try {
      setLoadingMyResponses(true);
      const response = await api.get("/requirements/my-responses");
      setMyResponses(response.data.data || []);
    } catch (error) {
      console.error("Error fetching my responses:", error);
    } finally {
      setLoadingMyResponses(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "my-responses") {
      fetchMyResponses();
    }
  }, [activeTab, fetchMyResponses]);

  const handleNotifyVehicleAdded = async () => {
    if (!selectedResponseForNotify) return;

    try {
      setNotifyingVehicle(true);
      const response = await api.post(
        `/requirements/${selectedResponseForNotify.requirementId}/notify-vehicle-added`,
        {
          message: notifyMessage,
        },
      );

      if (response.data.success) {
        toast.success(
          "Corporate has been notified that the vehicle is now available!",
        );
        setShowNotifyModal(false);
        setSelectedResponseForNotify(null);
        setNotifyMessage("");
        fetchMyResponses(); // Refresh
      }
    } catch (error) {
      console.error("Error notifying vehicle added:", error);
      toast.error(
        error.response?.data?.message || "Failed to notify corporate",
      );
    } finally {
      setNotifyingVehicle(false);
    }
  };

  const openNotifyModal = (responseData) => {
    setSelectedResponseForNotify(responseData);
    setNotifyMessage("");
    setShowNotifyModal(true);
  };

  const getResponseTypeColor = (responseType) => {
    switch (responseType) {
      case "INTERESTED":
        return "#10b981";
      case "WILL_ADD_VEHICLE":
        return "#3b82f6";
      case "NOT_INTERESTED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getResponseTypeLabel = (responseType) => {
    switch (responseType) {
      case "INTERESTED":
        return "Interested";
      case "WILL_ADD_VEHICLE":
        return "Will Add Vehicle";
      case "NOT_INTERESTED":
        return "Not Interested";
      default:
        return responseType;
    }
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
        <h2>{activeTab === "open" ? "Open Requirements" : "My Responses"}</h2>
        <p>
          {activeTab === "open"
            ? "Find and quote on transportation requirements from corporate clients"
            : "View your responses to corporate requirements"}
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        className="b2bpartner-RequirementsTab-tabs"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: "0",
        }}
      >
        <button
          onClick={() => setActiveTab("open")}
          style={{
            padding: "12px 20px",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "open" ? "600" : "400",
            color: activeTab === "open" ? "#3b82f6" : "#64748b",
            borderBottom:
              activeTab === "open"
                ? "2px solid #3b82f6"
                : "2px solid transparent",
            marginBottom: "-2px",
            transition: "all 0.2s",
          }}
        >
          Open Requirements
        </button>
        <button
          onClick={() => setActiveTab("my-responses")}
          style={{
            padding: "12px 20px",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "my-responses" ? "600" : "400",
            color: activeTab === "my-responses" ? "#3b82f6" : "#64748b",
            borderBottom:
              activeTab === "my-responses"
                ? "2px solid #3b82f6"
                : "2px solid transparent",
            marginBottom: "-2px",
            transition: "all 0.2s",
          }}
        >
          My Responses
        </button>
      </div>

      {activeTab === "open" && (
        <>
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
                          <CompanyLogo
                            logo={requirement.corporateId?.companyLogo}
                            name={
                              requirement.corporateId?.companyName ||
                              "Corporate"
                            }
                          />
                          <span className="b2bpartner-RequirementsTab-company-name">
                            {requirement.corporateId?.companyName ||
                              "Corporate"}
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
                          {requirement.vehicleRequirements.map(
                            (vehicle, index) => (
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
                            ),
                          )}
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
                            style={{
                              color: getDeadlineColor(daysUntilDeadline),
                            }}
                          >
                            {new Date(
                              requirement.quotationDeadline,
                            ).toLocaleDateString()}{" "}
                            ({daysUntilDeadline} days left)
                          </span>
                        </div>
                        <div className="b2bpartner-RequirementsTab-action-buttons">
                          {/* Check if already responded */}
                          {requirement.partnerResponses?.some(
                            (r) => r.partnerId === auth.user?._id,
                          ) ? (
                            <span
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                                borderRadius: "6px",
                                fontSize: "13px",
                                fontWeight: "500",
                              }}
                            >
                              Already Responded
                            </span>
                          ) : (
                            <button
                              className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-outline"
                              onClick={() =>
                                setSelectedRequirement(requirement)
                              }
                            >
                              View Details
                            </button>
                          )}
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
        </>
      )}

      {/* My Responses Tab */}
      {activeTab === "my-responses" && (
        <div className="b2bpartner-RequirementsTab-my-responses">
          {loadingMyResponses ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#64748b" }}
            >
              Loading your responses...
            </div>
          ) : myResponses.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "60px", color: "#64748b" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#374151" }}>
                No Responses Yet
              </h3>
              <p style={{ margin: 0 }}>
                You have not responded to any corporate requirements yet.
                <br />
                Browse open requirements and submit your interest.
              </p>
              <button
                onClick={() => setActiveTab("open")}
                style={{
                  marginTop: "20px",
                  padding: "10px 20px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Browse Open Requirements
              </button>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {myResponses.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: "20px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    backgroundColor: "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "15px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>
                        {item.title}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "8px",
                        }}
                      >
                        {item.corporateId?.companyLogo ? (
                          <img
                            src={item.corporateId.companyLogo}
                            alt={item.corporateId?.companyName || "Corporate"}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span style={{ fontSize: "14px", color: "#64748b" }}>
                          {item.corporateId?.companyName || "Corporate"}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          color: "#64748b",
                        }}
                      >
                        {item.routeInfo?.fromLocation} to{" "}
                        {item.routeInfo?.toLocation}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "white",
                          backgroundColor: getResponseTypeColor(
                            item.myResponse?.responseType,
                          ),
                        }}
                      >
                        {getResponseTypeLabel(item.myResponse?.responseType)}
                      </span>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {item.myResponse?.respondedAt &&
                          new Date(
                            item.myResponse.respondedAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                      </span>
                    </div>
                  </div>

                  {/* Vehicle Requirements Summary */}
                  <div style={{ marginBottom: "15px" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Required:{" "}
                      {item.vehicleRequirements
                        ?.map((v) => `${v.quantity}x ${v.vehicleType}`)
                        .join(", ")}
                    </span>
                    <span
                      style={{
                        marginLeft: "15px",
                        fontSize: "13px",
                        color: "#3b82f6",
                        fontWeight: "500",
                      }}
                    >
                      Budget: {item.contractDetails?.budgetRange?.min} -{" "}
                      {item.contractDetails?.budgetRange?.max}{" "}
                      {item.contractDetails?.budgetRange?.currency}
                    </span>
                  </div>

                  {item.myResponse?.message && (
                    <div
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#f8fafc",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: "#374151",
                        marginBottom: "15px",
                      }}
                    >
                      <strong>Your Message:</strong> {item.myResponse.message}
                    </div>
                  )}

                  {/* Will Add Vehicle - Notify Button */}
                  {item.myResponse?.responseType === "WILL_ADD_VEHICLE" && (
                    <div
                      style={{
                        padding: "15px",
                        backgroundColor: item.myResponse.vehicleAddedNotified
                          ? "#dcfce7"
                          : "#eff6ff",
                        borderRadius: "8px",
                        border: item.myResponse.vehicleAddedNotified
                          ? "1px solid #86efac"
                          : "1px solid #bfdbfe",
                      }}
                    >
                      {item.myResponse.vehicleAddedNotified ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            color: "#166534",
                          }}
                        >
                          <span style={{ fontSize: "20px" }}>check_mark</span>
                          <div>
                            <p style={{ margin: 0, fontWeight: "500" }}>
                              Corporate Notified
                            </p>
                            <p
                              style={{ margin: "4px 0 0 0", fontSize: "13px" }}
                            >
                              The corporate has been informed that your vehicle
                              is now available.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "10px",
                            }}
                          >
                            <span style={{ fontSize: "20px" }}>info</span>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: "500",
                                  color: "#1e40af",
                                }}
                              >
                                Have you added the vehicle?
                              </p>
                              {item.myResponse.estimatedAvailability && (
                                <p
                                  style={{
                                    margin: "4px 0 0 0",
                                    fontSize: "13px",
                                    color: "#374151",
                                  }}
                                >
                                  Estimated availability:{" "}
                                  {new Date(
                                    item.myResponse.estimatedAvailability,
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => openNotifyModal(item)}
                            style={{
                              padding: "10px 20px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontWeight: "500",
                              width: "100%",
                            }}
                          >
                            Notify Corporate - Vehicle is Ready
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notify Vehicle Added Modal */}
      {showNotifyModal && selectedResponseForNotify && (
        <div className="b2bpartner-RequirementsTab-modal-overlay">
          <div
            className="b2bpartner-RequirementsTab-modal"
            style={{ maxWidth: "500px" }}
          >
            <div className="b2bpartner-RequirementsTab-modal-header">
              <h3>Notify Corporate</h3>
              <button
                className="b2bpartner-RequirementsTab-close-btn"
                onClick={() => {
                  setShowNotifyModal(false);
                  setSelectedResponseForNotify(null);
                  setNotifyMessage("");
                }}
              >
                x
              </button>
            </div>
            <div className="b2bpartner-RequirementsTab-modal-content">
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                }}
              >
                <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>
                  {selectedResponseForNotify.title}
                </h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  {selectedResponseForNotify.corporateId?.companyName}
                </p>
              </div>

              <p style={{ color: "#374151", marginBottom: "15px" }}>
                Let the corporate know that you have added the vehicle they were
                looking for. They will receive an email and in-app notification.
              </p>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Additional Message (Optional)
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="Add any details about the vehicle you have added..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => {
                    setShowNotifyModal(false);
                    setSelectedResponseForNotify(null);
                    setNotifyMessage("");
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#f1f5f9",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleNotifyVehicleAdded}
                  disabled={notifyingVehicle}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: notifyingVehicle ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    opacity: notifyingVehicle ? 0.7 : 1,
                  }}
                >
                  {notifyingVehicle ? "Sending..." : "Send Notification"}
                </button>
              </div>
            </div>
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
                    handleOpenResponseModal(selectedRequirement);
                  }}
                >
                  Respond to Requirement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequirement && (
        <div className="b2bpartner-RequirementsTab-modal-overlay">
          <div
            className="b2bpartner-RequirementsTab-modal"
            style={{ maxWidth: "600px" }}
          >
            <div className="b2bpartner-RequirementsTab-modal-header">
              <h3>Respond to Requirement</h3>
              <button
                className="b2bpartner-RequirementsTab-close-btn"
                onClick={() => {
                  setShowResponseModal(false);
                  setSelectedRequirement(null);
                }}
              >
                x
              </button>
            </div>
            <div className="b2bpartner-RequirementsTab-modal-content">
              <div
                className="b2bpartner-RequirementsTab-response-info"
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0", color: "#1e293b" }}>
                  {selectedRequirement.title}
                </h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  {selectedRequirement.corporateId?.companyName} |{" "}
                  {selectedRequirement.routeInfo?.fromLocation} to{" "}
                  {selectedRequirement.routeInfo?.toLocation}
                </p>
              </div>

              <div
                className="b2bpartner-RequirementsTab-form-group"
                style={{ marginBottom: "20px" }}
              >
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Response Type
                </label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 15px",
                      border:
                        responseForm.responseType === "INTERESTED"
                          ? "2px solid #10b981"
                          : "1px solid #d1d5db",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        responseForm.responseType === "INTERESTED"
                          ? "#f0fdf4"
                          : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="responseType"
                      value="INTERESTED"
                      checked={responseForm.responseType === "INTERESTED"}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          responseType: e.target.value,
                        })
                      }
                    />
                    <span>Interested</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 15px",
                      border:
                        responseForm.responseType === "WILL_ADD_VEHICLE"
                          ? "2px solid #3b82f6"
                          : "1px solid #d1d5db",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        responseForm.responseType === "WILL_ADD_VEHICLE"
                          ? "#eff6ff"
                          : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="responseType"
                      value="WILL_ADD_VEHICLE"
                      checked={responseForm.responseType === "WILL_ADD_VEHICLE"}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          responseType: e.target.value,
                        })
                      }
                    />
                    <span>Will Add Vehicle</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 15px",
                      border:
                        responseForm.responseType === "NOT_INTERESTED"
                          ? "2px solid #ef4444"
                          : "1px solid #d1d5db",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        responseForm.responseType === "NOT_INTERESTED"
                          ? "#fef2f2"
                          : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="responseType"
                      value="NOT_INTERESTED"
                      checked={responseForm.responseType === "NOT_INTERESTED"}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          responseType: e.target.value,
                        })
                      }
                    />
                    <span>Not Interested</span>
                  </label>
                </div>
              </div>

              {responseForm.responseType === "WILL_ADD_VEHICLE" && (
                <>
                  <div
                    className="b2bpartner-RequirementsTab-form-group"
                    style={{ marginBottom: "15px" }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                        color: "#374151",
                      }}
                    >
                      Estimated Availability Date
                    </label>
                    <input
                      type="date"
                      value={responseForm.estimatedAvailability}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          estimatedAvailability: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div
                    className="b2bpartner-RequirementsTab-form-group"
                    style={{ marginBottom: "15px" }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                        color: "#374151",
                      }}
                    >
                      Vehicle Details (Optional)
                    </label>
                    <textarea
                      value={responseForm.vehicleDetails}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          vehicleDetails: e.target.value,
                        })
                      }
                      placeholder="Describe the vehicle you plan to add (e.g., make, model, capacity, features)"
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "14px",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </>
              )}

              <div
                className="b2bpartner-RequirementsTab-form-group"
                style={{ marginBottom: "20px" }}
              >
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Message to Corporate
                </label>
                <textarea
                  value={responseForm.message}
                  onChange={(e) =>
                    setResponseForm({
                      ...responseForm,
                      message: e.target.value,
                    })
                  }
                  placeholder={
                    responseForm.responseType === "INTERESTED"
                      ? "I am interested in this requirement and can provide the requested vehicles..."
                      : responseForm.responseType === "WILL_ADD_VEHICLE"
                        ? "I will add this type of vehicle to my fleet soon..."
                        : "Thank you for the opportunity, but I cannot fulfill this requirement because..."
                  }
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                className="b2bpartner-RequirementsTab-modal-actions"
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-secondary"
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedRequirement(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="b2bpartner-RequirementsTab-btn b2bpartner-RequirementsTab-btn-primary"
                  onClick={handleSubmitResponse}
                  disabled={submittingResponse}
                  style={{ opacity: submittingResponse ? 0.7 : 1 }}
                >
                  {submittingResponse ? "Submitting..." : "Submit Response"}
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
