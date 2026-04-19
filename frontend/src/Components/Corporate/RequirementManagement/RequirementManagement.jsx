/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import api from "../../../utils/api";
import "./RequirementManagement.css";

function RequirementManagement() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statistics, setStatistics] = useState(null);
  const [showQuotationsModal, setShowQuotationsModal] = useState(false);
  const [quotationsForRequirement, setQuotationsForRequirement] = useState([]);
  const [
    selectedRequirementForQuotations,
    setSelectedRequirementForQuotations,
  ] = useState(null);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  // B2B Partner responses state
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [responsesForRequirement, setResponsesForRequirement] = useState([]);
  const [selectedRequirementForResponses, setSelectedRequirementForResponses] =
    useState(null);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // View Requirement Details Modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewRequirement, setViewRequirement] = useState(null);
  const [viewRequirementResponses, setViewRequirementResponses] = useState([]);
  const [loadingViewResponses, setLoadingViewResponses] = useState(false);

  // Form state
  const [requirementForm, setRequirementForm] = useState({
    title: "",
    description: "",
    vehicleRequirements: [
      {
        vehicleType: "BUS",
        capacity: 30,
        quantity: 1,
        features: ["AC"],
        preferredBrands: [],
        ageLimit: 5,
      },
    ],
    routeInfo: {
      fromLocation: "",
      toLocation: "",
      stops: [],
      estimatedDistance: 0,
      estimatedDuration: "",
    },
    scheduleRequirements: {
      serviceType: "DAILY",
      operatingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "08:00",
      endTime: "18:00",
      frequency: "ROUND_TRIP",
    },
    contractDetails: {
      duration: 12,
      startDate: "",
      endDate: "",
      budgetRange: {
        min: 0,
        max: 0,
        currency: "KWD",
      },
      paymentTerms: "MONTHLY",
    },
    driverRequirements: {
      required: true,
      licenseType: "HEAVY",
      experience: 2,
      languages: ["ENGLISH"],
      backgroundCheck: true,
    },
    fuelRequirements: {
      included: true,
      type: "ANY",
    },
    additionalRequirements: {
      insurance: true,
      maintenance: true,
      tracking: true,
      emergencySupport: true,
      specialInstructions: "",
    },
    visibility: "PUBLIC",
    quotationDeadline: "",
    priority: "MEDIUM",
    tags: [],
  });

  useEffect(() => {
    fetchRequirements();
    fetchStatistics();
  }, [currentPage, searchTerm, filterStatus]);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const response = await api.get("/requirements/corporate", {
        params: {
          page: currentPage,
          limit: 10,
          search: searchTerm || undefined,
          status: filterStatus !== "all" ? filterStatus : undefined,
        },
      });
      setRequirements(response.data.data.requirements);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error) {
      console.error("Error fetching requirements:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get("/requirements/statistics");
      setStatistics(response.data.data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  };

  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/requirements", requirementForm);
      setShowCreateModal(false);
      resetRequirementForm();
      fetchRequirements();
      fetchStatistics();
      alert("Requirement created successfully!");
    } catch (error) {
      console.error("Error creating requirement:", error);
      alert(error.response?.data?.message || "Failed to create requirement");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishRequirement = async (requirementId) => {
    try {
      await api.post(`/requirements/${requirementId}/publish`);
      fetchRequirements();
      fetchStatistics();
      alert("Requirement published successfully!");
    } catch (error) {
      console.error("Error publishing requirement:", error);
      alert(error.response?.data?.message || "Failed to publish requirement");
    }
  };

  const handleCloseRequirement = async (requirementId) => {
    if (!window.confirm("Are you sure you want to close this requirement?")) {
      return;
    }

    try {
      await api.post(`/requirements/${requirementId}/close`);
      fetchRequirements();
      fetchStatistics();
      alert("Requirement closed successfully!");
    } catch (error) {
      console.error("Error closing requirement:", error);
      alert(error.response?.data?.message || "Failed to close requirement");
    }
  };

  const handleDeleteRequirement = async (requirementId) => {
    if (!window.confirm("Are you sure you want to delete this requirement?")) {
      return;
    }

    try {
      await api.delete(`/requirements/${requirementId}`);
      fetchRequirements();
      fetchStatistics();
      alert("Requirement deleted successfully!");
    } catch (error) {
      console.error("Error deleting requirement:", error);
      alert(error.response?.data?.message || "Failed to delete requirement");
    }
  };

  const handleViewQuotations = async (requirement) => {
    try {
      setLoadingQuotations(true);
      setSelectedRequirementForQuotations(requirement);
      setShowQuotationsModal(true);
      const response = await api.get(
        `/requirements/${requirement._id}/quotations`,
      );
      setQuotationsForRequirement(response.data.data.quotations || []);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      alert(error.response?.data?.message || "Failed to fetch quotations");
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleSelectQuotation = async (requirementId, quotationId) => {
    if (
      !window.confirm(
        "Are you sure you want to select this quotation? Other quotations will be rejected.",
      )
    ) {
      return;
    }
    try {
      setLoadingQuotations(true);
      await api.post(`/requirements/${requirementId}/select-quotation`, {
        quotationId,
        message: "Quotation selected for contract creation",
      });
      alert(
        "Quotation selected successfully! You can now proceed to create a contract.",
      );
      setShowQuotationsModal(false);
      fetchRequirements();
      fetchStatistics();
    } catch (error) {
      console.error("Error selecting quotation:", error);
      alert(error.response?.data?.message || "Failed to select quotation");
    } finally {
      setLoadingQuotations(false);
    }
  };

  // View B2B Partner responses
  const handleViewResponses = async (requirement) => {
    try {
      setLoadingResponses(true);
      setSelectedRequirementForResponses(requirement);
      setShowResponsesModal(true);
      const response = await api.get(
        `/requirements/${requirement._id}/responses`,
      );
      setResponsesForRequirement(response.data.data.responses || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
      alert(error.response?.data?.message || "Failed to fetch responses");
    } finally {
      setLoadingResponses(false);
    }
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

  // View requirement details with partner responses
  const handleViewRequirement = async (requirement) => {
    setViewRequirement(requirement);
    setShowViewModal(true);
    setLoadingViewResponses(true);

    try {
      const response = await api.get(
        `/requirements/${requirement._id}/responses`,
      );
      setViewRequirementResponses(response.data.data.responses || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
      setViewRequirementResponses([]);
    } finally {
      setLoadingViewResponses(false);
    }
  };

  const resetRequirementForm = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setRequirementForm({
      title: "",
      description: "",
      vehicleRequirements: [
        {
          vehicleType: "BUS",
          capacity: 30,
          quantity: 1,
          features: ["AC"],
          preferredBrands: [],
          ageLimit: 5,
        },
      ],
      routeInfo: {
        fromLocation: "",
        toLocation: "",
        stops: [],
        estimatedDistance: 0,
        estimatedDuration: "",
      },
      scheduleRequirements: {
        serviceType: "DAILY",
        operatingDays: ["MON", "TUE", "WED", "THU", "FRI"],
        startTime: "08:00",
        endTime: "18:00",
        frequency: "ROUND_TRIP",
      },
      contractDetails: {
        duration: 12,
        startDate: tomorrow.toISOString().split("T")[0],
        endDate: nextMonth.toISOString().split("T")[0],
        budgetRange: {
          min: 0,
          max: 0,
          currency: "KWD",
        },
        paymentTerms: "MONTHLY",
      },
      driverRequirements: {
        required: true,
        licenseType: "HEAVY",
        experience: 2,
        languages: ["ENGLISH"],
        backgroundCheck: true,
      },
      fuelRequirements: {
        included: true,
        type: "ANY",
      },
      additionalRequirements: {
        insurance: true,
        maintenance: true,
        tracking: true,
        emergencySupport: true,
        specialInstructions: "",
      },
      visibility: "PUBLIC",
      quotationDeadline: tomorrow.toISOString().split("T")[0],
      priority: "MEDIUM",
      tags: [],
    });
  };

  const addVehicleRequirement = () => {
    setRequirementForm((prev) => ({
      ...prev,
      vehicleRequirements: [
        ...prev.vehicleRequirements,
        {
          vehicleType: "BUS",
          capacity: 30,
          quantity: 1,
          features: ["AC"],
          preferredBrands: [],
          ageLimit: 5,
        },
      ],
    }));
  };

  const removeVehicleRequirement = (index) => {
    setRequirementForm((prev) => ({
      ...prev,
      vehicleRequirements: prev.vehicleRequirements.filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const updateVehicleRequirement = (index, field, value) => {
    setRequirementForm((prev) => ({
      ...prev,
      vehicleRequirements: prev.vehicleRequirements.map((req, i) =>
        i === index ? { ...req, [field]: value } : req,
      ),
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "#6b7280";
      case "PUBLISHED":
        return "#3b82f6";
      case "IN_PROGRESS":
        return "#f59e0b"; // Amber for in progress
      case "CLOSED":
        return "#10b981";
      case "CANCELLED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
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

  const renderContent = () => {
    switch (activeTab) {
      case "list":
        return (
          <div className="drivemego-crm-requirement-list">
            {/* Statistics Cards */}
            {statistics && (
              <div className="drivemego-crm-stats-cards">
                <div className="drivemego-crm-stat-card">
                  <div className="drivemego-crm-stat-icon">📋</div>
                  <div className="drivemego-crm-stat-content">
                    <div className="drivemego-crm-stat-label">
                      Total Requirements
                    </div>
                    <div className="drivemego-crm-stat-value">
                      {statistics.totalRequirements}
                    </div>
                  </div>
                </div>
                <div className="drivemego-crm-stat-card">
                  <div className="drivemego-crm-stat-icon">📊</div>
                  <div className="drivemego-crm-stat-content">
                    <div className="drivemego-crm-stat-label">
                      Open for Quotations
                    </div>
                    <div className="drivemego-crm-stat-value">
                      {statistics.openQuotations}
                    </div>
                  </div>
                </div>
                <div className="drivemego-crm-stat-card">
                  <div className="drivemego-crm-stat-icon">💰</div>
                  <div className="drivemego-crm-stat-content">
                    <div className="drivemego-crm-stat-label">Total Budget</div>
                    <div className="drivemego-crm-stat-value">
                      {statistics.statusBreakdown?.reduce(
                        (sum, stat) => sum + (stat.totalBudget || 0),
                        0,
                      )}{" "}
                      KWD
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="drivemego-crm-list-header">
              <div className="drivemego-crm-search-filters">
                <input
                  type="text"
                  placeholder="Search requirements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="drivemego-crm-search-input"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="drivemego-crm-filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <button
                className="drivemego-crm-btn drivemego-crm-btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Requirement
              </button>
            </div>

            {loading ? (
              <div className="drivemego-crm-loading">
                Loading requirements...
              </div>
            ) : (
              <div className="drivemego-crm-requirements-table">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Route</th>
                      <th>Vehicles</th>
                      <th>Budget</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((requirement) => (
                      <tr key={requirement._id}>
                        <td>
                          <div className="drivemego-crm-requirement-title">
                            {requirement.title}
                            {requirement.tags.length > 0 && (
                              <div className="drivemego-crm-tags">
                                {requirement.tags
                                  .slice(0, 2)
                                  .map((tag, index) => (
                                    <span
                                      key={index}
                                      className="drivemego-crm-tag"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {requirement.routeInfo.fromLocation} →{" "}
                          {requirement.routeInfo.toLocation}
                        </td>
                        <td>
                          {requirement.vehicleRequirements.map((req, index) => (
                            <div
                              key={index}
                              className="drivemego-crm-vehicle-info"
                            >
                              {req.quantity}x {req.vehicleType} ({req.capacity}{" "}
                              seats)
                            </div>
                          ))}
                        </td>
                        <td>
                          {requirement.contractDetails.budgetRange.min} -{" "}
                          {requirement.contractDetails.budgetRange.max}{" "}
                          {requirement.contractDetails.budgetRange.currency}
                        </td>
                        <td>
                          {new Date(
                            requirement.quotationDeadline,
                          ).toLocaleDateString()}
                        </td>
                        <td>
                          <span
                            className="drivemego-crm-status-badge"
                            style={{
                              backgroundColor: getStatusColor(
                                requirement.status,
                              ),
                            }}
                          >
                            {requirement.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className="drivemego-crm-priority-badge"
                            style={{
                              backgroundColor: getPriorityColor(
                                requirement.priority,
                              ),
                            }}
                          >
                            {requirement.priority}
                          </span>
                        </td>
                        <td>
                          <div className="drivemego-crm-action-buttons">
                            <button
                              className="drivemego-crm-btn drivemego-crm-btn-sm drivemego-crm-btn-outline"
                              onClick={() => handleViewRequirement(requirement)}
                            >
                              View
                            </button>
                            <button
                              className="drivemego-crm-btn drivemego-crm-btn-sm drivemego-crm-btn-danger"
                              onClick={() =>
                                handleDeleteRequirement(requirement._id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="drivemego-crm-pagination">
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
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="drivemego-crm-requirement-management">
      <div className="drivemego-crm-management-header">
        <h2>Requirement Management</h2>
        <div className="drivemego-crm-tab-navigation">
          <button
            className={`drivemego-crm-tab-btn ${activeTab === "list" ? "drivemego-crm-active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            Requirements List
          </button>
        </div>
      </div>

      <div className="drivemego-crm-management-content">{renderContent()}</div>

      {/* Create Requirement Modal */}
      {showCreateModal && (
        <div className="drivemego-crm-modal-overlay">
          <div className="drivemego-crm-modal drivemego-crm-large-modal">
            <div className="drivemego-crm-modal-header">
              <h3>Create New Requirement</h3>
              <button
                className="drivemego-crm-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={handleCreateRequirement}
              className="drivemego-crm-modal-form"
            >
              <div className="drivemego-crm-form-section">
                <h4>Basic Information</h4>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Requirement Title{" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter requirement title"
                      value={requirementForm.title}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Priority <span className="drivemego-crm-required">*</span>
                    </label>
                    <select
                      value={requirementForm.priority}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="drivemego-crm-form-group drivemego-crm-form-group-full">
                  <label className="drivemego-crm-form-label">
                    Description{" "}
                    <span className="drivemego-crm-required">*</span>
                  </label>
                  <textarea
                    className="drivemego-crm-textarea"
                    placeholder="Describe your requirement in detail..."
                    value={requirementForm.description}
                    onChange={(e) =>
                      setRequirementForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={4}
                    required
                  />
                </div>
              </div>

              <div className="drivemego-crm-form-section">
                <h4>Vehicle Requirements</h4>
                {requirementForm.vehicleRequirements.map((vehicle, index) => (
                  <div
                    key={index}
                    className="drivemego-crm-vehicle-requirement-card"
                  >
                    <div className="drivemego-crm-vehicle-header">
                      <span className="drivemego-crm-vehicle-number">
                        Vehicle {index + 1}
                      </span>
                      {requirementForm.vehicleRequirements.length > 1 && (
                        <button
                          type="button"
                          className="drivemego-crm-btn drivemego-crm-btn-sm drivemego-crm-btn-danger"
                          onClick={() => removeVehicleRequirement(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="drivemego-crm-form-row">
                      <div className="drivemego-crm-form-group">
                        <label className="drivemego-crm-form-label">
                          Vehicle Type{" "}
                          <span className="drivemego-crm-required">*</span>
                        </label>
                        <select
                          value={vehicle.vehicleType}
                          onChange={(e) =>
                            updateVehicleRequirement(
                              index,
                              "vehicleType",
                              e.target.value,
                            )
                          }
                        >
                          <option value="BUS">Bus</option>
                          <option value="VAN">Van</option>
                          <option value="MINIBUS">Minibus</option>
                          <option value="SEDAN">Sedan</option>
                          <option value="SUV">SUV</option>
                          <option value="TRUCK">Truck</option>
                        </select>
                      </div>
                      <div className="drivemego-crm-form-group">
                        <label className="drivemego-crm-form-label">
                          Capacity (Seats){" "}
                          <span className="drivemego-crm-required">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="e.g., 30"
                          value={vehicle.capacity}
                          onChange={(e) =>
                            updateVehicleRequirement(
                              index,
                              "capacity",
                              parseInt(e.target.value),
                            )
                          }
                          min="1"
                          required
                        />
                      </div>
                      <div className="drivemego-crm-form-group">
                        <label className="drivemego-crm-form-label">
                          Quantity{" "}
                          <span className="drivemego-crm-required">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="e.g., 1"
                          value={vehicle.quantity}
                          onChange={(e) =>
                            updateVehicleRequirement(
                              index,
                              "quantity",
                              parseInt(e.target.value),
                            )
                          }
                          min="1"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="drivemego-crm-btn drivemego-crm-btn-secondary"
                  onClick={addVehicleRequirement}
                >
                  + Add Vehicle Type
                </button>
              </div>

              <div className="drivemego-crm-form-section">
                <h4>Route Information</h4>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      From Location{" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter pickup location"
                      value={requirementForm.routeInfo.fromLocation}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          routeInfo: {
                            ...prev.routeInfo,
                            fromLocation: e.target.value,
                          },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      To Location{" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter drop-off location"
                      value={requirementForm.routeInfo.toLocation}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          routeInfo: {
                            ...prev.routeInfo,
                            toLocation: e.target.value,
                          },
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Estimated Distance (km)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 50"
                      value={requirementForm.routeInfo.estimatedDistance}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          routeInfo: {
                            ...prev.routeInfo,
                            estimatedDistance: parseInt(e.target.value),
                          },
                        }))
                      }
                      min="1"
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Estimated Duration
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2 hours 30 minutes"
                      value={requirementForm.routeInfo.estimatedDuration}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          routeInfo: {
                            ...prev.routeInfo,
                            estimatedDuration: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="drivemego-crm-form-section">
                <h4>Contract Details</h4>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Duration (Months){" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 12"
                      value={requirementForm.contractDetails.duration}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            duration: parseInt(e.target.value),
                          },
                        }))
                      }
                      min="1"
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Start Date{" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="date"
                      value={requirementForm.contractDetails.startDate}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            startDate: e.target.value,
                          },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      End Date <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="date"
                      value={requirementForm.contractDetails.endDate}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            endDate: e.target.value,
                          },
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Minimum Budget (KWD){" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 500"
                      value={requirementForm.contractDetails.budgetRange.min}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            budgetRange: {
                              ...prev.contractDetails.budgetRange,
                              min: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      min="0"
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Maximum Budget (KWD){" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 2000"
                      value={requirementForm.contractDetails.budgetRange.max}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            budgetRange: {
                              ...prev.contractDetails.budgetRange,
                              max: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      min="0"
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Payment Frequency
                    </label>
                    <select
                      value={requirementForm.contractDetails.paymentTerms}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          contractDetails: {
                            ...prev.contractDetails,
                            paymentTerms: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="ANNUALLY">Annually</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="drivemego-crm-form-section">
                <h4>Schedule & Deadline</h4>
                <div className="drivemego-crm-form-row">
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Quotation Deadline{" "}
                      <span className="drivemego-crm-required">*</span>
                    </label>
                    <input
                      type="date"
                      value={requirementForm.quotationDeadline}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          quotationDeadline: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="drivemego-crm-form-group">
                    <label className="drivemego-crm-form-label">
                      Visibility
                    </label>
                    <select
                      value={requirementForm.visibility}
                      onChange={(e) =>
                        setRequirementForm((prev) => ({
                          ...prev,
                          visibility: e.target.value,
                        }))
                      }
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE">Private</option>
                      <option value="INVITE_ONLY">Invite Only</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="drivemego-crm-modal-actions">
                <button
                  type="button"
                  className="drivemego-crm-btn drivemego-crm-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-crm-btn drivemego-crm-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Requirement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quotations Modal */}
      {showQuotationsModal && selectedRequirementForQuotations && (
        <div className="drivemego-crm-modal-overlay">
          <div className="drivemego-crm-modal drivemego-crm-large-modal">
            <div className="drivemego-crm-modal-header">
              <h3>Quotations for: {selectedRequirementForQuotations.title}</h3>
              <button
                className="drivemego-crm-close-btn"
                onClick={() => {
                  setShowQuotationsModal(false);
                  setQuotationsForRequirement([]);
                  setSelectedRequirementForQuotations(null);
                }}
              >
                &times;
              </button>
            </div>
            <div
              className="drivemego-crm-modal-body"
              style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px" }}
            >
              {loadingQuotations ? (
                <div className="drivemego-crm-loading">
                  Loading quotations...
                </div>
              ) : quotationsForRequirement.length === 0 ? (
                <div
                  className="drivemego-crm-empty-state"
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#6b7280",
                  }}
                >
                  <p style={{ fontSize: "16px", fontWeight: "500" }}>
                    No quotations received yet
                  </p>
                  <p style={{ fontSize: "14px", marginTop: "8px" }}>
                    B2B Partners will submit quotations after viewing your
                    published requirement.
                  </p>
                </div>
              ) : (
                <div
                  className="drivemego-crm-quotations-list"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {quotationsForRequirement.map((quotation) => (
                    <div
                      key={quotation._id}
                      className="drivemego-crm-quotation-card"
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "20px",
                        backgroundColor:
                          quotation.status === "ACCEPTED" ? "#f0fdf4" : "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "12px",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "16px",
                              fontWeight: "600",
                            }}
                          >
                            {quotation.fleetOwnerId?.companyName ||
                              quotation.fleetOwnerId?.businessName ||
                              quotation.fleetOwnerId?.fullName ||
                              "B2B Partner"}
                          </h4>
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: "13px",
                              color: "#6b7280",
                            }}
                          >
                            {quotation.fleetOwnerId?.email}
                          </p>
                        </div>
                        <span
                          className="drivemego-crm-status-badge"
                          style={{
                            backgroundColor:
                              quotation.status === "QUOTED"
                                ? "#3b82f6"
                                : quotation.status === "ACCEPTED"
                                  ? "#10b981"
                                  : quotation.status === "REJECTED"
                                    ? "#ef4444"
                                    : "#6b7280",
                            color: "#fff",
                            padding: "4px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {quotation.status}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: "10px",
                            borderRadius: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Total Amount
                          </div>
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "700",
                              color: "#111827",
                            }}
                          >
                            {quotation.quotedPrice?.totalAmount?.toLocaleString() ||
                              0}{" "}
                            {quotation.quotedPrice?.currency || "KWD"}
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: "10px",
                            borderRadius: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Valid Until
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#111827",
                            }}
                          >
                            {quotation.validUntil
                              ? new Date(
                                  quotation.validUntil,
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: "10px",
                            borderRadius: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Submitted
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#111827",
                            }}
                          >
                            {quotation.respondedAt
                              ? new Date(
                                  quotation.respondedAt,
                                ).toLocaleDateString()
                              : new Date(
                                  quotation.createdAt,
                                ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {quotation.quotedPrice?.breakdown && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "8px",
                            marginBottom: "12px",
                            fontSize: "13px",
                          }}
                        >
                          <div>
                            <span style={{ color: "#6b7280" }}>
                              Vehicle Rental:
                            </span>{" "}
                            {quotation.quotedPrice.breakdown.vehicleRental?.toLocaleString() ||
                              0}{" "}
                            KWD
                          </div>
                          <div>
                            <span style={{ color: "#6b7280" }}>Driver:</span>{" "}
                            {quotation.quotedPrice.breakdown.driverCharges?.toLocaleString() ||
                              0}{" "}
                            KWD
                          </div>
                          <div>
                            <span style={{ color: "#6b7280" }}>Fuel:</span>{" "}
                            {quotation.quotedPrice.breakdown.fuelCharges?.toLocaleString() ||
                              0}{" "}
                            KWD
                          </div>
                        </div>
                      )}

                      {quotation.responseMessage && (
                        <div
                          style={{
                            padding: "10px",
                            background: "#f0f4ff",
                            borderRadius: "8px",
                            marginBottom: "12px",
                            fontSize: "13px",
                            color: "#374151",
                          }}
                        >
                          <strong>Partner Message:</strong>{" "}
                          {quotation.responseMessage}
                        </div>
                      )}

                      {quotation.status === "QUOTED" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            className="drivemego-crm-btn drivemego-crm-btn-success"
                            onClick={() =>
                              handleSelectQuotation(
                                selectedRequirementForQuotations._id,
                                quotation._id,
                              )
                            }
                            disabled={loadingQuotations}
                            style={{ padding: "8px 20px", fontSize: "13px" }}
                          >
                            Select This Quotation
                          </button>
                        </div>
                      )}

                      {quotation.status === "ACCEPTED" && (
                        <div
                          style={{
                            padding: "10px",
                            background: "#dcfce7",
                            borderRadius: "8px",
                            fontSize: "13px",
                            color: "#166534",
                            fontWeight: "500",
                            textAlign: "center",
                          }}
                        >
                          Selected Quotation - Contract can now be created
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Requirement Details Modal */}
      {showViewModal && viewRequirement && (
        <div className="drivemego-crm-modal-overlay">
          <div
            className="drivemego-crm-modal"
            style={{ maxWidth: "900px", maxHeight: "90vh", overflow: "auto" }}
          >
            <div className="drivemego-crm-modal-header">
              <h3>Requirement Details</h3>
              <button
                className="drivemego-crm-close-btn"
                onClick={() => {
                  setShowViewModal(false);
                  setViewRequirement(null);
                  setViewRequirementResponses([]);
                }}
              >
                x
              </button>
            </div>
            <div className="drivemego-crm-modal-content">
              {/* Requirement Info */}
              <div style={{ margin: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: "0 0 8px 0",
                        color: "#1e293b",
                        fontSize: "20px",
                      }}
                    >
                      {viewRequirement.title}
                    </h2>
                    <p
                      style={{ margin: 0, color: "#64748b", fontSize: "14px" }}
                    >
                      {viewRequirement.description}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor:
                          viewRequirement.status === "DRAFT"
                            ? "#f1f5f9"
                            : viewRequirement.status === "PUBLISHED"
                              ? "#dbeafe"
                              : viewRequirement.status === "IN_PROGRESS"
                                ? "#fef3c7"
                                : "#dcfce7",
                        color:
                          viewRequirement.status === "DRAFT"
                            ? "#475569"
                            : viewRequirement.status === "PUBLISHED"
                              ? "#1d4ed8"
                              : viewRequirement.status === "IN_PROGRESS"
                                ? "#92400e"
                                : "#166534",
                      }}
                    >
                      {viewRequirement.status}
                    </span>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor:
                          viewRequirement.priority === "URGENT"
                            ? "#fef2f2"
                            : viewRequirement.priority === "HIGH"
                              ? "#fff7ed"
                              : "#f0fdf4",
                        color:
                          viewRequirement.priority === "URGENT"
                            ? "#dc2626"
                            : viewRequirement.priority === "HIGH"
                              ? "#ea580c"
                              : "#16a34a",
                      }}
                    >
                      {viewRequirement.priority}
                    </span>
                  </div>
                </div>

                {/* Route Info */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Route Information
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        From:
                      </span>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          color: "#1e293b",
                          fontWeight: "500",
                        }}
                      >
                        {viewRequirement.routeInfo?.fromLocation}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        To:
                      </span>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          color: "#1e293b",
                          fontWeight: "500",
                        }}
                      >
                        {viewRequirement.routeInfo?.toLocation}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Distance:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.routeInfo?.estimatedDistance} km
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Duration:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.routeInfo?.estimatedDuration}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Requirements */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Vehicle Requirements
                  </h4>
                  {viewRequirement.vehicleRequirements?.map((vr, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "20px",
                        alignItems: "center",
                        padding: "10px",
                        backgroundColor: "white",
                        borderRadius: "6px",
                        marginBottom:
                          idx < viewRequirement.vehicleRequirements.length - 1
                            ? "8px"
                            : "0",
                      }}
                    >
                      <span style={{ fontWeight: "600", color: "#3b82f6" }}>
                        {vr.quantity}x {vr.vehicleType}
                      </span>
                      <span style={{ color: "#64748b" }}>
                        {vr.capacity} seats
                      </span>
                      {vr.features?.length > 0 && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          {vr.features.map((f, i) => (
                            <span
                              key={i}
                              style={{
                                padding: "2px 8px",
                                backgroundColor: "#e2e8f0",
                                borderRadius: "4px",
                                fontSize: "11px",
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Contract Details */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Contract Details
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Budget Range:
                      </span>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          color: "#3b82f6",
                          fontWeight: "600",
                        }}
                      >
                        {viewRequirement.contractDetails?.budgetRange?.min} -{" "}
                        {viewRequirement.contractDetails?.budgetRange?.max}{" "}
                        {viewRequirement.contractDetails?.budgetRange?.currency}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Duration:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.contractDetails?.duration} months
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Payment Terms:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.contractDetails?.paymentTerms}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Schedule
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Service Type:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.scheduleRequirements?.serviceType}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Operating Days:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.scheduleRequirements?.operatingDays?.join(
                          ", ",
                        )}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Time:
                      </span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e293b" }}>
                        {viewRequirement.scheduleRequirements?.startTime} -{" "}
                        {viewRequirement.scheduleRequirements?.endTime}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Deadline */}
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor:
                      viewRequirement.quotationDeadline &&
                      new Date(viewRequirement.quotationDeadline) < new Date()
                        ? "#fef2f2"
                        : "#f0fdf4",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#374151", fontWeight: "500" }}>
                    Deadline:
                  </span>
                  <span
                    style={{
                      color:
                        viewRequirement.quotationDeadline &&
                        new Date(viewRequirement.quotationDeadline) < new Date()
                          ? "#dc2626"
                          : "#16a34a",
                      fontWeight: "600",
                    }}
                  >
                    {viewRequirement.quotationDeadline
                      ? new Date(
                          viewRequirement.quotationDeadline,
                        ).toLocaleDateString()
                      : "No deadline set"}
                  </span>
                </div>
              </div>

              {/* B2B Partner Responses Section */}
              <div
                style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px" }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    color: "#1e293b",
                    fontSize: "16px",
                    fontWeight: "600",
                  }}
                >
                  B2B Partner Responses ({viewRequirementResponses.length})
                </h3>

                {loadingViewResponses ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#64748b",
                    }}
                  >
                    Loading responses...
                  </div>
                ) : viewRequirementResponses.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#64748b",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>
                      📭
                    </div>
                    <p style={{ margin: 0 }}>
                      No B2B Partners have responded to this requirement yet.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {viewRequirementResponses.map((response, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "16px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          backgroundColor: "white",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            {response.partnerId?.companyLogo ? (
                              <img
                                src={response.partnerId.companyLogo}
                                alt={
                                  response.partnerId?.companyName ||
                                  response.partnerId?.businessName ||
                                  "Partner"
                                }
                                style={{
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              style={{
                                display: response.partnerId?.companyLogo
                                  ? "none"
                                  : "flex",
                                width: "44px",
                                height: "44px",
                                borderRadius: "8px",
                                backgroundColor: "#e2e8f0",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "18px",
                                fontWeight: "600",
                                color: "#64748b",
                              }}
                            >
                              {(
                                response.partnerId?.companyName ||
                                response.partnerId?.businessName ||
                                response.partnerId?.fullName ||
                                "P"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <h4
                                style={{
                                  margin: "0 0 4px 0",
                                  color: "#1e293b",
                                  fontSize: "15px",
                                }}
                              >
                                {response.partnerId?.companyName ||
                                  response.partnerId?.businessName ||
                                  response.partnerId?.fullName ||
                                  "B2B Partner"}
                              </h4>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}
                              >
                                {response.partnerId?.email || ""}
                                {response.partnerId?.whatsappNumber &&
                                  ` | ${response.partnerId.whatsappNumber}`}
                              </p>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                padding: "5px 12px",
                                borderRadius: "20px",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "white",
                                backgroundColor: getResponseTypeColor(
                                  response.responseType,
                                ),
                              }}
                            >
                              {getResponseTypeLabel(response.responseType)}
                            </span>
                            <span
                              style={{ fontSize: "11px", color: "#94a3b8" }}
                            >
                              {response.respondedAt &&
                                new Date(
                                  response.respondedAt,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            </span>
                          </div>
                        </div>

                        {response.responseType === "WILL_ADD_VEHICLE" && (
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: response.vehicleAddedNotified
                                ? "#dcfce7"
                                : "#eff6ff",
                              borderRadius: "6px",
                              marginBottom: "10px",
                              border: response.vehicleAddedNotified
                                ? "1px solid #86efac"
                                : "1px solid #bfdbfe",
                            }}
                          >
                            {response.vehicleAddedNotified ? (
                              <div
                                style={{
                                  color: "#166534",
                                  fontWeight: "500",
                                  fontSize: "13px",
                                }}
                              >
                                Vehicle has been added! You can now search for
                                this vehicle and request a quotation.
                              </div>
                            ) : (
                              <>
                                {response.estimatedAvailability && (
                                  <p
                                    style={{
                                      margin: "0 0 6px 0",
                                      fontSize: "13px",
                                      color: "#1e40af",
                                    }}
                                  >
                                    <strong>Estimated Availability:</strong>{" "}
                                    {new Date(
                                      response.estimatedAvailability,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                                {response.vehicleDetails && (
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: "13px",
                                      color: "#374151",
                                    }}
                                  >
                                    <strong>Vehicle Details:</strong>{" "}
                                    {response.vehicleDetails}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {response.message && (
                          <div
                            style={{
                              padding: "10px 12px",
                              backgroundColor: "#f8fafc",
                              borderRadius: "6px",
                              fontSize: "13px",
                              color: "#374151",
                              lineHeight: "1.5",
                            }}
                          >
                            <strong style={{ color: "#1e293b" }}>
                              Message:
                            </strong>{" "}
                            {response.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="drivemego-crm-btn drivemego-crm-btn-secondary"
                  onClick={() => {
                    setShowViewModal(false);
                    setViewRequirement(null);
                    setViewRequirementResponses([]);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B2B Partner Responses Modal */}
      {showResponsesModal && selectedRequirementForResponses && (
        <div className="drivemego-crm-modal-overlay">
          <div className="drivemego-crm-modal" style={{ maxWidth: "800px" }}>
            <div className="drivemego-crm-modal-header">
              <h3>B2B Partner Responses</h3>
              <button
                className="drivemego-crm-close-btn"
                onClick={() => {
                  setShowResponsesModal(false);
                  setSelectedRequirementForResponses(null);
                  setResponsesForRequirement([]);
                }}
              >
                x
              </button>
            </div>
            <div className="drivemego-crm-modal-content">
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                }}
              >
                <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>
                  {selectedRequirementForResponses.title}
                </h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  {selectedRequirementForResponses.routeInfo?.fromLocation} to{" "}
                  {selectedRequirementForResponses.routeInfo?.toLocation}
                </p>
              </div>

              {loadingResponses ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748b",
                  }}
                >
                  Loading responses...
                </div>
              ) : responsesForRequirement.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748b",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📭
                  </div>
                  <h4 style={{ margin: "0 0 8px 0", color: "#374151" }}>
                    No Responses Yet
                  </h4>
                  <p style={{ margin: 0 }}>
                    B2B Partners have not responded to this requirement yet.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {responsesForRequirement.map((response, index) => (
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          {response.partnerId?.companyLogo ? (
                            <img
                              src={response.partnerId.companyLogo}
                              alt={
                                response.partnerId?.companyName ||
                                response.partnerId?.businessName ||
                                "Partner"
                              }
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "8px",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "8px",
                                backgroundColor: "#e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                fontWeight: "600",
                                color: "#64748b",
                              }}
                            >
                              {(
                                response.partnerId?.companyName ||
                                response.partnerId?.businessName ||
                                response.partnerId?.fullName ||
                                "P"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4
                              style={{ margin: "0 0 4px 0", color: "#1e293b" }}
                            >
                              {response.partnerId?.companyName ||
                                response.partnerId?.businessName ||
                                response.partnerId?.fullName ||
                                "B2B Partner"}
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#64748b",
                              }}
                            >
                              {response.partnerId?.email || ""}
                              {response.partnerId?.whatsappNumber &&
                                ` | ${response.partnerId.whatsappNumber}`}
                            </p>
                          </div>
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
                                response.responseType,
                              ),
                            }}
                          >
                            {getResponseTypeLabel(response.responseType)}
                          </span>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            {response.respondedAt &&
                              new Date(response.respondedAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                          </span>
                        </div>
                      </div>

                      {response.responseType === "WILL_ADD_VEHICLE" && (
                        <div
                          style={{
                            padding: "12px 15px",
                            backgroundColor: "#eff6ff",
                            borderRadius: "8px",
                            marginBottom: "12px",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <span style={{ fontSize: "16px" }}>📅</span>
                            <span
                              style={{ fontWeight: "500", color: "#1e40af" }}
                            >
                              {response.vehicleAddedNotified
                                ? "Vehicle Added!"
                                : "Planning to Add Vehicle"}
                            </span>
                          </div>
                          {response.estimatedAvailability && (
                            <p
                              style={{
                                margin: "0 0 6px 0",
                                fontSize: "13px",
                                color: "#374151",
                              }}
                            >
                              <strong>Estimated Availability:</strong>{" "}
                              {new Date(
                                response.estimatedAvailability,
                              ).toLocaleDateString()}
                            </p>
                          )}
                          {response.vehicleDetails && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#374151",
                              }}
                            >
                              <strong>Vehicle Details:</strong>{" "}
                              {response.vehicleDetails}
                            </p>
                          )}
                          {response.vehicleAddedNotified && (
                            <div
                              style={{
                                marginTop: "10px",
                                padding: "8px 12px",
                                backgroundColor: "#dcfce7",
                                borderRadius: "6px",
                                fontSize: "13px",
                                color: "#166534",
                                fontWeight: "500",
                              }}
                            >
                              This partner has notified you that the vehicle is
                              now available. Search for their vehicle on the
                              platform to request a quotation.
                            </div>
                          )}
                        </div>
                      )}

                      {response.message && (
                        <div
                          style={{
                            padding: "12px 15px",
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "#374151",
                            lineHeight: "1.5",
                          }}
                        >
                          <strong style={{ color: "#1e293b" }}>Message:</strong>{" "}
                          {response.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="drivemego-crm-btn drivemego-crm-btn-secondary"
                  onClick={() => {
                    setShowResponsesModal(false);
                    setSelectedRequirementForResponses(null);
                    setResponsesForRequirement([]);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequirementManagement;
