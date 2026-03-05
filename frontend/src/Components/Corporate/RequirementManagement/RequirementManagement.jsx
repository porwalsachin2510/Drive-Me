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
  const [selectedRequirementForQuotations, setSelectedRequirementForQuotations] = useState(null);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  // Form state
  const [requirementForm, setRequirementForm] = useState({
    title: "",
    description: "",
    vehicleRequirements: [{
      vehicleType: "BUS",
      capacity: 30,
      quantity: 1,
      features: ["AC"],
      preferredBrands: [],
      ageLimit: 5
    }],
    routeInfo: {
      fromLocation: "",
      toLocation: "",
      stops: [],
      estimatedDistance: 0,
      estimatedDuration: ""
    },
    scheduleRequirements: {
      serviceType: "DAILY",
      operatingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "08:00",
      endTime: "18:00",
      frequency: "ROUND_TRIP"
    },
    contractDetails: {
      duration: 12,
      startDate: "",
      endDate: "",
      budgetRange: {
        min: 0,
        max: 0,
        currency: "KWD"
      },
      paymentTerms: "MONTHLY"
    },
    driverRequirements: {
      required: true,
      licenseType: "HEAVY",
      experience: 2,
      languages: ["ENGLISH"],
      backgroundCheck: true
    },
    fuelRequirements: {
      included: true,
      type: "ANY"
    },
    additionalRequirements: {
      insurance: true,
      maintenance: true,
      tracking: true,
      emergencySupport: true,
      specialInstructions: ""
    },
    visibility: "PUBLIC",
    quotationDeadline: "",
    priority: "MEDIUM",
    tags: []
  });

  useEffect(() => {
    fetchRequirements();
    fetchStatistics();
  }, [currentPage, searchTerm, filterStatus]);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/requirements/corporate', {
        params: {
          page: currentPage,
          limit: 10,
          search: searchTerm || undefined,
          status: filterStatus !== "all" ? filterStatus : undefined
        }
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
      const response = await api.get('/requirements/statistics');
      setStatistics(response.data.data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  };

  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/requirements', requirementForm);
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
      const response = await api.get(`/requirements/${requirement._id}/quotations`);
      setQuotationsForRequirement(response.data.data.quotations || []);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      alert(error.response?.data?.message || "Failed to fetch quotations");
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleSelectQuotation = async (requirementId, quotationId) => {
    if (!window.confirm("Are you sure you want to select this quotation? Other quotations will be rejected.")) {
      return;
    }
    try {
      setLoadingQuotations(true);
      await api.post(`/requirements/${requirementId}/select-quotation`, {
        quotationId,
        message: "Quotation selected for contract creation"
      });
      alert("Quotation selected successfully! You can now proceed to create a contract.");
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

  const resetRequirementForm = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setRequirementForm({
      title: "",
      description: "",
      vehicleRequirements: [{
        vehicleType: "BUS",
        capacity: 30,
        quantity: 1,
        features: ["AC"],
        preferredBrands: [],
        ageLimit: 5
      }],
      routeInfo: {
        fromLocation: "",
        toLocation: "",
        stops: [],
        estimatedDistance: 0,
        estimatedDuration: ""
      },
      scheduleRequirements: {
        serviceType: "DAILY",
        operatingDays: ["MON", "TUE", "WED", "THU", "FRI"],
        startTime: "08:00",
        endTime: "18:00",
        frequency: "ROUND_TRIP"
      },
      contractDetails: {
        duration: 12,
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: nextMonth.toISOString().split('T')[0],
        budgetRange: {
          min: 0,
          max: 0,
          currency: "KWD"
        },
        paymentTerms: "MONTHLY"
      },
      driverRequirements: {
        required: true,
        licenseType: "HEAVY",
        experience: 2,
        languages: ["ENGLISH"],
        backgroundCheck: true
      },
      fuelRequirements: {
        included: true,
        type: "ANY"
      },
      additionalRequirements: {
        insurance: true,
        maintenance: true,
        tracking: true,
        emergencySupport: true,
        specialInstructions: ""
      },
      visibility: "PUBLIC",
      quotationDeadline: tomorrow.toISOString().split('T')[0],
      priority: "MEDIUM",
      tags: []
    });
  };

  const addVehicleRequirement = () => {
    setRequirementForm(prev => ({
      ...prev,
      vehicleRequirements: [...prev.vehicleRequirements, {
        vehicleType: "BUS",
        capacity: 30,
        quantity: 1,
        features: ["AC"],
        preferredBrands: [],
        ageLimit: 5
      }]
    }));
  };

  const removeVehicleRequirement = (index) => {
    setRequirementForm(prev => ({
      ...prev,
      vehicleRequirements: prev.vehicleRequirements.filter((_, i) => i !== index)
    }));
  };

  const updateVehicleRequirement = (index, field, value) => {
    setRequirementForm(prev => ({
      ...prev,
      vehicleRequirements: prev.vehicleRequirements.map((req, i) => 
        i === index ? { ...req, [field]: value } : req
      )
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT": return "#6b7280";
      case "PUBLISHED": return "#3b82f6";
      case "CLOSED": return "#10b981";
      case "CANCELLED": return "#ef4444";
      default: return "#6b7280";
    }
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

  const renderContent = () => {
    switch (activeTab) {
      case "list":
        return (
          <div className="requirement-list">
            {/* Statistics Cards */}
            {statistics && (
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-icon">📋</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Requirements</div>
                    <div className="stat-value">{statistics.totalRequirements}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Open for Quotations</div>
                    <div className="stat-value">{statistics.openQuotations}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Budget</div>
                    <div className="stat-value">
                      {statistics.statusBreakdown?.reduce((sum, stat) => sum + (stat.totalBudget || 0), 0)} KWD
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="list-header">
              <div className="search-filters">
                <input
                  type="text"
                  placeholder="Search requirements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Requirement
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading requirements...</div>
            ) : (
              <div className="requirements-table">
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
                          <div className="requirement-title">
                            {requirement.title}
                            {requirement.tags.length > 0 && (
                              <div className="tags">
                                {requirement.tags.slice(0, 2).map((tag, index) => (
                                  <span key={index} className="tag">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {requirement.routeInfo.fromLocation} → {requirement.routeInfo.toLocation}
                        </td>
                        <td>
                          {requirement.vehicleRequirements.map((req, index) => (
                            <div key={index} className="vehicle-info">
                              {req.quantity}x {req.vehicleType} ({req.capacity} seats)
                            </div>
                          ))}
                        </td>
                        <td>
                          {requirement.contractDetails.budgetRange.min} - {requirement.contractDetails.budgetRange.max} {requirement.contractDetails.budgetRange.currency}
                        </td>
                        <td>
                          {new Date(requirement.quotationDeadline).toLocaleDateString()}
                        </td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(requirement.status) }}
                          >
                            {requirement.status}
                          </span>
                        </td>
                        <td>
                          <span 
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(requirement.priority) }}
                          >
                            {requirement.priority}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => setSelectedRequirement(requirement)}
                            >
                              View
                            </button>
                            {requirement.status === "DRAFT" && (
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handlePublishRequirement(requirement._id)}
                              >
                                Publish
                              </button>
                            )}
                            {requirement.status === "PUBLISHED" && (
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleCloseRequirement(requirement._id)}
                              >
                                Close
                              </button>
                            )}
                            {requirement.status === "DRAFT" && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteRequirement(requirement._id)}
                              >
                                Delete
                              </button>
                            )}
                            {(requirement.status === "PUBLISHED" || requirement.status === "CLOSED") && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleViewQuotations(requirement)}
                              >
                                Quotations ({requirement.quotations?.length || 0})
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
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
    <div className="requirement-management">
      <div className="management-header">
        <h2>Requirement Management</h2>
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            Requirements List
          </button>
        </div>
      </div>

      <div className="management-content">
        {renderContent()}
      </div>

      {/* Create Requirement Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Create New Requirement</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRequirement} className="modal-form">
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Requirement Title"
                    value={requirementForm.title}
                    onChange={(e) => setRequirementForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                  <select
                    value={requirementForm.priority}
                    onChange={(e) => setRequirementForm(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <textarea
                  placeholder="Describe your requirement in detail..."
                  value={requirementForm.description}
                  onChange={(e) => setRequirementForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="form-section">
                <h4>Vehicle Requirements</h4>
                {requirementForm.vehicleRequirements.map((vehicle, index) => (
                  <div key={index} className="vehicle-requirement-card">
                    <div className="form-row">
                      <select
                        value={vehicle.vehicleType}
                        onChange={(e) => updateVehicleRequirement(index, 'vehicleType', e.target.value)}
                      >
                        <option value="BUS">Bus</option>
                        <option value="VAN">Van</option>
                        <option value="MINIBUS">Minibus</option>
                        <option value="SEDAN">Sedan</option>
                        <option value="SUV">SUV</option>
                        <option value="TRUCK">Truck</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Capacity"
                        value={vehicle.capacity}
                        onChange={(e) => updateVehicleRequirement(index, 'capacity', parseInt(e.target.value))}
                        min="1"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={vehicle.quantity}
                        onChange={(e) => updateVehicleRequirement(index, 'quantity', parseInt(e.target.value))}
                        min="1"
                        required
                      />
                      {requirementForm.vehicleRequirements.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeVehicleRequirement(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addVehicleRequirement}
                >
                  + Add Vehicle Type
                </button>
              </div>

              <div className="form-section">
                <h4>Route Information</h4>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="From Location"
                    value={requirementForm.routeInfo.fromLocation}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      routeInfo: { ...prev.routeInfo, fromLocation: e.target.value }
                    }))}
                    required
                  />
                  <input
                    type="text"
                    placeholder="To Location"
                    value={requirementForm.routeInfo.toLocation}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      routeInfo: { ...prev.routeInfo, toLocation: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="number"
                    placeholder="Estimated Distance (km)"
                    value={requirementForm.routeInfo.estimatedDistance}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      routeInfo: { ...prev.routeInfo, estimatedDistance: parseInt(e.target.value) }
                    }))}
                    min="1"
                  />
                  <input
                    type="text"
                    placeholder="Estimated Duration (e.g., 2 hours 30 minutes)"
                    value={requirementForm.routeInfo.estimatedDuration}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      routeInfo: { ...prev.routeInfo, estimatedDuration: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Contract Details</h4>
                <div className="form-row">
                  <input
                    type="number"
                    placeholder="Duration (months)"
                    value={requirementForm.contractDetails.duration}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: { ...prev.contractDetails, duration: parseInt(e.target.value) }
                    }))}
                    min="1"
                    required
                  />
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={requirementForm.contractDetails.startDate}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: { ...prev.contractDetails, startDate: e.target.value }
                    }))}
                    required
                  />
                  <input
                    type="date"
                    placeholder="End Date"
                    value={requirementForm.contractDetails.endDate}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: { ...prev.contractDetails, endDate: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="number"
                    placeholder="Min Budget"
                    value={requirementForm.contractDetails.budgetRange.min}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: {
                        ...prev.contractDetails,
                        budgetRange: { ...prev.contractDetails.budgetRange, min: parseFloat(e.target.value) }
                      }
                    }))}
                    min="0"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Max Budget"
                    value={requirementForm.contractDetails.budgetRange.max}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: {
                        ...prev.contractDetails,
                        budgetRange: { ...prev.contractDetails.budgetRange, max: parseFloat(e.target.value) }
                      }
                    }))}
                    min="0"
                    required
                  />
                  <select
                    value={requirementForm.contractDetails.paymentTerms}
                    onChange={(e) => setRequirementForm(prev => ({
                      ...prev,
                      contractDetails: { ...prev.contractDetails, paymentTerms: e.target.value }
                    }))}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUALLY">Annually</option>
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h4>Schedule & Deadline</h4>
                <div className="form-row">
                  <input
                    type="date"
                    placeholder="Quotation Deadline"
                    value={requirementForm.quotationDeadline}
                    onChange={(e) => setRequirementForm(prev => ({ ...prev, quotationDeadline: e.target.value }))}
                    required
                  />
                  <select
                    value={requirementForm.visibility}
                    onChange={(e) => setRequirementForm(prev => ({ ...prev, visibility: e.target.value }))}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                    <option value="INVITE_ONLY">Invite Only</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Quotations for: {selectedRequirementForQuotations.title}</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowQuotationsModal(false);
                  setQuotationsForRequirement([]);
                  setSelectedRequirementForQuotations(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              {loadingQuotations ? (
                <div className="loading">Loading quotations...</div>
              ) : quotationsForRequirement.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', fontWeight: '500' }}>No quotations received yet</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    B2B Partners will submit quotations after viewing your published requirement.
                  </p>
                </div>
              ) : (
                <div className="quotations-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {quotationsForRequirement.map((quotation) => (
                    <div
                      key={quotation._id}
                      className="quotation-card"
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: quotation.status === 'ACCEPTED' ? '#f0fdf4' : '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                            {quotation.fleetOwnerId?.companyName || quotation.fleetOwnerId?.businessName || quotation.fleetOwnerId?.fullName || 'B2B Partner'}
                          </h4>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                            {quotation.fleetOwnerId?.email}
                          </p>
                        </div>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor:
                              quotation.status === 'QUOTED' ? '#3b82f6' :
                              quotation.status === 'ACCEPTED' ? '#10b981' :
                              quotation.status === 'REJECTED' ? '#ef4444' : '#6b7280',
                            color: '#fff',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {quotation.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Total Amount</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                            {quotation.quotedPrice?.totalAmount?.toLocaleString() || 0} {quotation.quotedPrice?.currency || 'KWD'}
                          </div>
                        </div>
                        <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Valid Until</div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Submitted</div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {quotation.respondedAt ? new Date(quotation.respondedAt).toLocaleDateString() : new Date(quotation.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {quotation.quotedPrice?.breakdown && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                          <div><span style={{ color: '#6b7280' }}>Vehicle Rental:</span> {quotation.quotedPrice.breakdown.vehicleRental?.toLocaleString() || 0} KWD</div>
                          <div><span style={{ color: '#6b7280' }}>Driver:</span> {quotation.quotedPrice.breakdown.driverCharges?.toLocaleString() || 0} KWD</div>
                          <div><span style={{ color: '#6b7280' }}>Fuel:</span> {quotation.quotedPrice.breakdown.fuelCharges?.toLocaleString() || 0} KWD</div>
                        </div>
                      )}

                      {quotation.responseMessage && (
                        <div style={{ padding: '10px', background: '#f0f4ff', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#374151' }}>
                          <strong>Partner Message:</strong> {quotation.responseMessage}
                        </div>
                      )}

                      {quotation.status === 'QUOTED' && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-success"
                            onClick={() => handleSelectQuotation(selectedRequirementForQuotations._id, quotation._id)}
                            disabled={loadingQuotations}
                            style={{ padding: '8px 20px', fontSize: '13px' }}
                          >
                            Select This Quotation
                          </button>
                        </div>
                      )}

                      {quotation.status === 'ACCEPTED' && (
                        <div style={{ padding: '10px', background: '#dcfce7', borderRadius: '8px', fontSize: '13px', color: '#166534', fontWeight: '500', textAlign: 'center' }}>
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
    </div>
  );
}

export default RequirementManagement;
