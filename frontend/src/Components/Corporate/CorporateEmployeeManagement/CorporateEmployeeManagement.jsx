/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../utils/api";
import "./CorporateEmployeeManagement.css";

function CorporateEmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  console.log("availableRoutes", availableRoutes);

  // Form states - match backend CorporateEmployee model schema
  const [employeeForm, setEmployeeForm] = useState({
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      department: "",
      designation: "",
      workLocation: ""
    },
    residentialAddress: {
      street: "",
      area: "",
      city: "",
      state: "",
      postalCode: ""
    },
    transportDetails: {
      assignedRoute: "",
      pickupPoint: "",
      dropOffPoint: "",
      shiftType: "FULL_DAY"
    }
  });

  console.log("employeeForm", employeeForm);


  const [bulkUploadData, setBulkUploadData] = useState({
    employees: []
  });

  useEffect(() => {
    fetchEmployees();
    fetchAvailableRoutes();
  }, [currentPage, searchTerm, filterStatus]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
      };
      // Map frontend filter to backend isActive param
      if (filterStatus === "active") params.isActive = "true";
      else if (filterStatus === "inactive") params.isActive = "false";
      
      const response = await api.get('/corporate-employees', { params });
      setEmployees(response.data.data.employees || []);
      setTotalPages(response.data.data.pagination?.totalPages || response.data.data.pagination?.pages || 1);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoutes = async () => {
    try {
      // Backend: GET /api/corporate-operations/assigned-routes-status
      const response = await api.get('/corporate-operations/assigned-routes-status');
      const routesData = response.data?.data;

      console.log("routesData", routesData);

      // Ensure availableRoutes is always an array
      if (Array.isArray(routesData)) {
        setAvailableRoutes(routesData);
      } else if (routesData && Array.isArray(routesData.routes)) {
        setAvailableRoutes(routesData.routes);
      } else if (routesData && Array.isArray(routesData.assignedRoutes)) {
        setAvailableRoutes(routesData.assignedRoutes);
      } else {
        setAvailableRoutes([]);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
      setAvailableRoutes([]);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Convert form to flat format that backend bulkUpload expects
      const employeeData = {
        fullName: `${employeeForm.personalInfo.firstName} ${employeeForm.personalInfo.lastName}`.trim(),
        email: employeeForm.personalInfo.email,
        contactNumber: employeeForm.personalInfo.phoneNumber,
        department: employeeForm.personalInfo.department,
        designation: employeeForm.personalInfo.designation,
        workLocation: employeeForm.personalInfo.workLocation,
        residentialAddress: employeeForm.residentialAddress,
        routeId: employeeForm.transportDetails.assignedRoute || undefined,
        pickupLocation: employeeForm.transportDetails.pickupPoint,
        dropoffLocation: employeeForm.transportDetails.dropOffPoint,
        workShift: employeeForm.transportDetails.shiftType
      };

      console.log("my corporate employeeData", employeeData);


      await api.post('/corporate-employees/bulk-upload', {
        employees: [employeeData]
      });
      setShowAddModal(false);
      resetEmployeeForm();
      fetchEmployees();
      alert("Employee added successfully!");
    } catch (error) {
      console.error("Error adding employee:", error);
      alert(error.response?.data?.message || "Failed to add employee");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Validate that we have employees to upload
      if (!bulkUploadData.employees || !Array.isArray(bulkUploadData.employees) || bulkUploadData.employees.length === 0) {
        alert("No employees data to upload. Please select a valid JSON file.");
        return;
      }
      
      // Backend: POST /api/corporate-employees/bulk-upload
      const response = await api.post('/corporate-employees/bulk-upload', bulkUploadData);
      setShowBulkUploadModal(false);
      setBulkUploadData({ employees: [] });
      fetchEmployees();
      
      const successCount = response.data?.data?.successful?.length || response.data?.data?.created || 0;
      const failCount = response.data?.data?.failed?.length || response.data?.data?.errors || 0;
      alert(`Bulk upload completed! ${successCount} successful, ${failCount} failed`);
    } catch (error) {
      console.error("Error in bulk upload:", error);
      alert(error.response?.data?.message || "Failed to complete bulk upload");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransport = async (employeeId, transportData) => {
    try {
      await api.put(`/corporate-employees/${employeeId}`, transportData);
      fetchEmployees();
      alert("Transport details updated successfully!");
    } catch (error) {
      console.error("Error updating transport:", error);
      alert(error.response?.data?.message || "Failed to update transport");
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) {
      return;
    }

    try {
      await api.delete(`/corporate-employees/${employeeId}`);
      fetchEmployees();
      alert("Employee deleted successfully!");
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert(error.response?.data?.message || "Failed to delete employee");
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      personalInfo: {
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        department: "",
        designation: "",
        workLocation: ""
      },
      residentialAddress: {
        street: "",
        area: "",
        city: "",
        state: "",
        postalCode: ""
      },
      transportDetails: {
        assignedRoute: "",
        pickupPoint: "",
        dropOffPoint: "",
        shiftType: "FULL_DAY"
      }
    });
  };

  const handleBulkUploadFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          setBulkUploadData({ employees: jsonData });
        } catch (error) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        fullName: "John Doe",
        email: "john@company.com",
        contactNumber: "+1234567890",
        department: "IT",
        designation: "Software Engineer",
        workLocation: "Main Office",
        residentialAddress: {
          street: "123 Main St",
          area: "Downtown",
          city: "New York",
          state: "NY",
          postalCode: "10001"
        },
        routeId: "",
        pickupLocation: "",
        dropoffLocation: "",
        workShift: "FULL_DAY"
      }
    ];

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendInvitations = async () => {
    if (selectedEmployeeIds.length === 0) {
      alert("Please select at least one employee to send invitations.");
      return;
    }
    if (!window.confirm(`Send invitations to ${selectedEmployeeIds.length} employee(s)?`)) {
      return;
    }
    try {
      setSendingInvitations(true);
      const response = await api.post('/corporate-employees/send-invitations', {
        employeeIds: selectedEmployeeIds
      });
      const sent = response.data?.data?.results?.sent?.length || 0;
      const failed = response.data?.data?.results?.failed?.length || 0;
      alert(`Invitations sent: ${sent} successful, ${failed} failed`);
      setSelectedEmployeeIds([]);
    } catch (error) {
      console.error("Error sending invitations:", error);
      alert(error.response?.data?.message || "Failed to send invitations");
    } finally {
      setSendingInvitations(false);
    }
  };

  const toggleEmployeeSelection = (empId) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map(e => e._id));
    }
  };

  // Helper to extract display fields from the nested model
  const getEmployeeName = (emp) => emp.fullName || `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || emp.userId?.fullName || 'N/A';
  const getEmployeeEmail = (emp) => emp.personalInfo?.email || emp.userId?.email || 'N/A';
  const getEmployeePhone = (emp) => emp.personalInfo?.phoneNumber || 'N/A';
  const getEmployeeDepartment = (emp) => emp.personalInfo?.department || 'N/A';
  const getEmployeeDesignation = (emp) => emp.personalInfo?.designation || 'N/A';
  const getEmployeeRoute = (emp) => {
    if (emp.transportDetails?.assignedRoute?.routeName) return emp.transportDetails.assignedRoute.routeName;
    if (emp.transportDetails?.assignedRoute?.fromLocation && emp.transportDetails?.assignedRoute?.toLocation) {
      return `${emp.transportDetails.assignedRoute.fromLocation} - ${emp.transportDetails.assignedRoute.toLocation}`;
    }
    return 'Not Assigned';
  };
  const getEmployeeStatus = (emp) => {
    if (emp.accessControl?.isActive === false) return false;
    if (emp.accessControl?.isActive === true) return true;
    return true; // default active
  };

  const renderContent = () => {
    switch (activeTab) {
      case "list":
        return (
          <div className="employee-list">
            <div className="list-header">
              <div className="search-filters">
                <input
                  type="text"
                  placeholder="Search employees..."
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Employee
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowBulkUploadModal(true)}
                >
                  Bulk Upload
                </button>
                {selectedEmployeeIds.length > 0 && (
                  <button
                    className="btn btn-success"
                    onClick={handleSendInvitations}
                    disabled={sendingInvitations}
                  >
                    {sendingInvitations ? "Sending..." : `Send Invitations (${selectedEmployeeIds.length})`}
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading employees...</div>
            ) : (
              <div className="employees-table">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.length === employees.length && employees.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                          No employees found. Add employees to get started.
                        </td>
                      </tr>
                    ) : (
                      employees.map((employee) => {
                        const isActive = getEmployeeStatus(employee);
                        return (
                          <tr key={employee._id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedEmployeeIds.includes(employee._id)}
                                onChange={() => toggleEmployeeSelection(employee._id)}
                              />
                            </td>
                            <td>{getEmployeeName(employee)}</td>
                            <td>{getEmployeeEmail(employee)}</td>
                            <td>{getEmployeePhone(employee)}</td>
                            <td>{getEmployeeDepartment(employee)}</td>
                            <td>{getEmployeeDesignation(employee)}</td>
                            <td>{getEmployeeRoute(employee)}</td>
                            <td>
                              <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => setSelectedEmployee(employee)}
                                >
                                  View
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteEmployee(employee._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
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
    <div className="corporate-employee-management">
      <div className="management-header">
        <h2>Employee Management</h2>
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            Employee List
          </button>
        </div>
      </div>

      <div className="management-content">{renderContent()}</div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Employee</h3>
              <button
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="modal-form">
              <div className="form-section">
                <h4>Personal Information</h4>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={employeeForm.personalInfo.firstName}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          firstName: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={employeeForm.personalInfo.lastName}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          lastName: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="email"
                    placeholder="Email"
                    value={employeeForm.personalInfo.email}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          email: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={employeeForm.personalInfo.phoneNumber}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          phoneNumber: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Department"
                    value={employeeForm.personalInfo.department}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          department: e.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Designation"
                    value={employeeForm.personalInfo.designation}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          designation: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Work Location"
                    value={employeeForm.personalInfo.workLocation}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        personalInfo: {
                          ...prev.personalInfo,
                          workLocation: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Transport Details</h4>
                <div className="form-row">
                  <select
                    value={employeeForm.transportDetails.assignedRoute}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          assignedRoute: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Select Route</option>
                    {Array.isArray(availableRoutes) &&
                      availableRoutes.map((route) => (
                        <option key={route.routeId} value={route.routeId}>
                          {route.routeName}
                        </option>
                      ))}
                  </select>
                  <select
                    value={employeeForm.transportDetails.shiftType}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          shiftType: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="FULL_DAY">Full Day</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Pickup Point"
                    value={employeeForm.transportDetails.pickupPoint}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          pickupPoint: e.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Drop-off Point"
                    value={employeeForm.transportDetails.dropOffPoint}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          dropOffPoint: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Bulk Upload Employees</h3>
              <button
                className="close-btn"
                onClick={() => setShowBulkUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="bulk-upload-instructions">
                <h4>Instructions:</h4>
                <ol>
                  <li>Download the sample template below</li>
                  <li>Fill in employee details in the JSON file</li>
                  <li>Upload the completed file</li>
                </ol>
                <button
                  type="button"
                  className="btn btn-info"
                  onClick={downloadSampleTemplate}
                >
                  📥 Download Sample Template
                </button>
              </div>

              <form onSubmit={handleBulkUpload} className="modal-form">
                <div className="form-group">
                  <label>Upload JSON File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleBulkUploadFile}
                    required
                  />
                </div>

                {bulkUploadData.employees.length > 0 && (
                  <div className="upload-preview">
                    <h4>
                      Preview ({bulkUploadData.employees.length} employees)
                    </h4>
                    <div className="preview-list">
                      {bulkUploadData.employees
                        .slice(0, 5)
                        .map((emp, index) => (
                          <div key={index} className="preview-item">
                            {emp.fullName ||
                              `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`}{" "}
                            - {emp.email || emp.personalInfo?.email || "N/A"}
                          </div>
                        ))}
                      {bulkUploadData.employees.length > 5 && (
                        <div className="preview-item">
                          ... and {bulkUploadData.employees.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowBulkUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || bulkUploadData.employees.length === 0}
                  >
                    {loading ? "Uploading..." : "Upload Employees"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CorporateEmployeeManagement;
