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
  const [selectedRouteSchedule, setSelectedRouteSchedule] = useState(null);
  const [routeSchedulesLoading, setRouteSchedulesLoading] = useState(false);
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
      workLocation: "",
    },
    homeAddress: "", // Employee's home address for determining nearest pickup stop
    residentialAddress: {
      street: "",
      area: "",
      city: "",
      state: "",
      postalCode: "",
    },
    transportDetails: {
      assignedRoute: "",
      selectedTripIndex: "", // Which trip from the schedule (0, 1, etc.)
      tripType: "", // "Round Trip" or "One Way" - auto-set based on selected trip
      // Outbound trip (home -> office)
      outboundPickupStop: "",
      outboundDropoffStop: "",
      // Return trip (office -> home) - only for Round Trip
      returnPickupStop: "",
      returnDropoffStop: "",
      shiftType: "FULL_DAY",
    },
    // Pass duration for route assignment
    passDuration: {
      durationType: "1_MONTH", // 1_MONTH, 2_MONTHS, 3_MONTHS, 6_MONTHS, 1_YEAR, CUSTOM
      startDate: new Date().toISOString().split("T")[0], // Default to today
      customEndDate: "",
    },
  });

  console.log("employeeForm", employeeForm);

  const [bulkUploadData, setBulkUploadData] = useState({
    employees: [],
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

      const response = await api.get("/corporate-employees", { params });
      setEmployees(response.data.data.employees || []);
      setTotalPages(
        response.data.data.pagination?.totalPages ||
          response.data.data.pagination?.pages ||
          1,
      );
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
      const response = await api.get(
        "/corporate-operations/assigned-routes-status",
      );
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

  // Fetch route schedule when route is selected
  const fetchRouteSchedule = async (routeId) => {
    if (!routeId) {
      setSelectedRouteSchedule(null);
      return;
    }

    try {
      setRouteSchedulesLoading(true);
      const response = await api.get(
        `/corporate-employees/route-schedule/${routeId}`,
      );
      if (response.data.success && response.data.data) {
        const scheduleData = response.data.data;
        setSelectedRouteSchedule(scheduleData);
        // Auto-select the first trip if available
        if (scheduleData.tripTimes && scheduleData.tripTimes.length > 0) {
          const firstTrip = scheduleData.tripTimes[0];
          setEmployeeForm((prev) => ({
            ...prev,
            transportDetails: {
              ...prev.transportDetails,
              selectedTripIndex: "0",
              tripType: firstTrip.tripType || "One Way",
              outboundDropoffStop: scheduleData.routeInfo?.toLocation || "",
              returnPickupStop:
                firstTrip.tripType === "Round Trip"
                  ? scheduleData.routeInfo?.toLocation || ""
                  : "",
            },
          }));
        }
      } else {
        setSelectedRouteSchedule(null);
      }
    } catch (error) {
      console.error("Error fetching route schedule:", error);
      setSelectedRouteSchedule(null);
    } finally {
      setRouteSchedulesLoading(false);
    }
  };

  // Handle route selection change
  const handleRouteChange = (routeId) => {
    // Reset transport details first, then fetch schedule which will auto-select first trip
    setEmployeeForm((prev) => ({
      ...prev,
      transportDetails: {
        ...prev.transportDetails,
        assignedRoute: routeId,
        selectedTripIndex: "0", // Default to first trip
        tripType: "",
        outboundPickupStop: "",
        outboundDropoffStop: "",
        returnPickupStop: "",
        returnDropoffStop: "",
      },
    }));
    fetchRouteSchedule(routeId);
  };

  // Handle trip selection change
  const handleTripSelection = (tripIndex) => {
    const selectedTrip = selectedRouteSchedule?.tripTimes?.[tripIndex];
    if (!selectedTrip) return;

    setEmployeeForm((prev) => ({
      ...prev,
      transportDetails: {
        ...prev.transportDetails,
        selectedTripIndex: tripIndex.toString(),
        tripType: selectedTrip.tripType,
        outboundPickupStop: "",
        outboundDropoffStop: selectedRouteSchedule?.routeInfo?.toLocation || "",
        returnPickupStop:
          selectedTrip.tripType === "Round Trip"
            ? selectedRouteSchedule?.routeInfo?.toLocation || ""
            : "",
        returnDropoffStop: "",
      },
    }));
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Get the selected trip details
      const selectedTripIndex =
        employeeForm.transportDetails.selectedTripIndex !== ""
          ? parseInt(employeeForm.transportDetails.selectedTripIndex)
          : 0;
      const selectedTrip =
        selectedRouteSchedule?.tripTimes?.[selectedTripIndex];

      // Convert form to flat format that backend bulkUpload expects
      const employeeData = {
        fullName:
          `${employeeForm.personalInfo.firstName} ${employeeForm.personalInfo.lastName}`.trim(),
        email: employeeForm.personalInfo.email,
        contactNumber: employeeForm.personalInfo.phoneNumber,
        department: employeeForm.personalInfo.department,
        designation: employeeForm.personalInfo.designation,
        workLocation: employeeForm.personalInfo.workLocation,
        homeAddress: employeeForm.homeAddress,
        residentialAddress: employeeForm.residentialAddress,
        routeId: employeeForm.transportDetails.assignedRoute || undefined,
        // Trip assignment details
        assignedTripNumber: selectedTrip?.tripNumber || 1,
        assignedTripType:
          selectedTrip?.tripType ||
          employeeForm.transportDetails.tripType ||
          "One Way",
        assignedTripDepartureTime: selectedTrip?.departureTime || "",
        // Outbound trip details (home -> office)
        outboundPickupStop: employeeForm.transportDetails.outboundPickupStop,
        outboundDropoffStop:
          employeeForm.transportDetails.outboundDropoffStop ||
          selectedRouteSchedule?.routeInfo?.toLocation,
        // Return trip details (office -> home) - only for Round Trip
        returnPickupStop: employeeForm.transportDetails.returnPickupStop,
        returnDropoffStop: employeeForm.transportDetails.returnDropoffStop,
        // Legacy fields for backward compatibility
        pickupLocation: employeeForm.transportDetails.outboundPickupStop,
        dropoffLocation:
          employeeForm.transportDetails.outboundDropoffStop ||
          selectedRouteSchedule?.routeInfo?.toLocation,
        workShift: employeeForm.transportDetails.shiftType,
        // Pass duration details
        passDuration: employeeForm.passDuration,
      };

      await api.post("/corporate-employees/bulk-upload", {
        employees: [employeeData],
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
      if (
        !bulkUploadData.employees ||
        !Array.isArray(bulkUploadData.employees) ||
        bulkUploadData.employees.length === 0
      ) {
        alert("No employees data to upload. Please select a valid JSON file.");
        return;
      }

      // Backend: POST /api/corporate-employees/bulk-upload
      const response = await api.post(
        "/corporate-employees/bulk-upload",
        bulkUploadData,
      );
      setShowBulkUploadModal(false);
      setBulkUploadData({ employees: [] });
      fetchEmployees();

      const successCount =
        response.data?.data?.successful?.length ||
        response.data?.data?.created ||
        0;
      const failCount =
        response.data?.data?.failed?.length || response.data?.data?.errors || 0;
      alert(
        `Bulk upload completed! ${successCount} successful, ${failCount} failed`,
      );
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
        workLocation: "",
      },
      homeAddress: "",
      residentialAddress: {
        street: "",
        area: "",
        city: "",
        state: "",
        postalCode: "",
      },
      transportDetails: {
        assignedRoute: "",
        selectedTripIndex: "",
        tripType: "",
        outboundPickupStop: "",
        outboundDropoffStop: "",
        returnPickupStop: "",
        returnDropoffStop: "",
        shiftType: "FULL_DAY",
      },
      passDuration: {
        durationType: "1_MONTH",
        startDate: new Date().toISOString().split("T")[0],
        customEndDate: "",
      },
    });
    setSelectedRouteSchedule(null);
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
          postalCode: "10001",
        },
        routeId: "",
        pickupLocation: "",
        dropoffLocation: "",
        workShift: "FULL_DAY",
      },
    ];

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendInvitations = async () => {
    if (selectedEmployeeIds.length === 0) {
      alert("Please select at least one employee to send invitations.");
      return;
    }
    if (
      !window.confirm(
        `Send invitations to ${selectedEmployeeIds.length} employee(s)?`,
      )
    ) {
      return;
    }
    try {
      setSendingInvitations(true);
      const response = await api.post("/corporate-employees/send-invitations", {
        employeeIds: selectedEmployeeIds,
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
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map((e) => e._id));
    }
  };

  // Helper to extract display fields from the nested model
  const getEmployeeName = (emp) =>
    emp.fullName ||
    `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`.trim() ||
    emp.userId?.fullName ||
    "N/A";
  const getEmployeeEmail = (emp) =>
    emp.personalInfo?.email || emp.userId?.email || "N/A";
  const getEmployeePhone = (emp) => emp.personalInfo?.phoneNumber || "N/A";
  const getEmployeeDepartment = (emp) => emp.personalInfo?.department || "N/A";
  const getEmployeeDesignation = (emp) =>
    emp.personalInfo?.designation || "N/A";
  const getEmployeeRoute = (emp) => {
    if (emp.transportDetails?.assignedRoute?.routeName)
      return emp.transportDetails.assignedRoute.routeName;
    if (
      emp.transportDetails?.assignedRoute?.fromLocation &&
      emp.transportDetails?.assignedRoute?.toLocation
    ) {
      return `${emp.transportDetails.assignedRoute.fromLocation} - ${emp.transportDetails.assignedRoute.toLocation}`;
    }
    return "Not Assigned";
  };
  const getEmployeeStatus = (emp) => {
    if (emp.accessControl?.isActive === false) return false;
    if (emp.accessControl?.isActive === true) return true;
    return true; // default active
  };
  const getEmployeeTripInfo = (emp) => {
    const td = emp.transportDetails;
    if (!td?.assignedTripNumber && !td?.assignedTripType && !td?.assignedRoute)
      return "Not Assigned";
    const tripNum = td.assignedTripNumber || 1;
    // Check if it's round trip - look at actual stored trip type first, then check for return trip info
    let tripType = td.assignedTripType;
    // If tripType is "One Way" but has return trip info, it's actually a Round Trip
    if (
      (!tripType || tripType === "One Way") &&
      (td.returnPickupStop || td.returnDropoffStop)
    ) {
      tripType = "Round Trip";
    }
    if (!tripType) tripType = "One Way";
    const pickup = td.outboundPickupStop || td.pickupPoint || "";
    return `Trip ${tripNum} (${tripType})${pickup ? ` - ${pickup}` : ""}`;
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
                    {sendingInvitations
                      ? "Sending..."
                      : `Send Invitations (${selectedEmployeeIds.length})`}
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
                          checked={
                            selectedEmployeeIds.length === employees.length &&
                            employees.length > 0
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Route</th>
                      <th>Trip Assignment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td
                          colSpan="10"
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#888",
                          }}
                        >
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
                                checked={selectedEmployeeIds.includes(
                                  employee._id,
                                )}
                                onChange={() =>
                                  toggleEmployeeSelection(employee._id)
                                }
                              />
                            </td>
                            <td>{getEmployeeName(employee)}</td>
                            <td>{getEmployeeEmail(employee)}</td>
                            <td>{getEmployeePhone(employee)}</td>
                            <td>{getEmployeeDepartment(employee)}</td>
                            <td>{getEmployeeDesignation(employee)}</td>
                            <td>{getEmployeeRoute(employee)}</td>
                            <td className="trip-assignment-cell">
                              {getEmployeeTripInfo(employee)}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${isActive ? "active" : "inactive"}`}
                              >
                                {isActive ? "Active" : "Inactive"}
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
                                  onClick={() =>
                                    handleDeleteEmployee(employee._id)
                                  }
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
                    placeholder="Work Location (Office)"
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
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Home Address (Employee's residential area for nearest pickup stop)"
                    value={employeeForm.homeAddress}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        homeAddress: e.target.value,
                      }))
                    }
                    className="full-width-input"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Transport Details</h4>
                <div className="form-row">
                  <select
                    value={employeeForm.transportDetails.assignedRoute}
                    onChange={(e) => handleRouteChange(e.target.value)}
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

                {/* Route Schedule Info */}
                {routeSchedulesLoading && (
                  <div className="route-schedule-loading">
                    <p>Loading route schedule...</p>
                  </div>
                )}

                {selectedRouteSchedule && !routeSchedulesLoading && (
                  <div className="route-schedule-info">
                    <h5>Route Schedule</h5>
                    <div className="schedule-details">
                      <p>
                        <strong>Route:</strong>{" "}
                        {selectedRouteSchedule.routeInfo?.fromLocation} &rarr;{" "}
                        {selectedRouteSchedule.routeInfo?.toLocation}
                      </p>
                      <p>
                        <strong>Available Days:</strong>{" "}
                        {selectedRouteSchedule.availableDays?.join(", ")}
                      </p>

                      {selectedRouteSchedule.tripTimes &&
                        selectedRouteSchedule.tripTimes.length > 0 && (
                          <div className="trip-times-info">
                            <h6>Trip Times</h6>
                            {selectedRouteSchedule.tripTimes.map(
                              (trip, idx) => (
                                <div key={idx} className="trip-time-item">
                                  <p>
                                    <strong>Trip {trip.tripNumber}:</strong>{" "}
                                    {trip.departureTime} ({trip.tripType})
                                  </p>
                                  {trip.outboundStopPoints &&
                                    trip.outboundStopPoints.length > 0 && (
                                      <div className="stop-points-list-info">
                                        <span className="stop-label outbound">
                                          Pickup Stops:
                                        </span>
                                        <ul>
                                          {trip.outboundStopPoints.map(
                                            (stop, sIdx) => (
                                              <li key={sIdx}>
                                                {stop.location} - {stop.time}
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Trip Selection - Which trip to assign to this employee */}
                {selectedRouteSchedule?.tripTimes?.length > 0 && (
                  <div className="trip-selection-section">
                    <h5>Select Trip to Assign</h5>
                    <div className="form-row">
                      <select
                        value={employeeForm.transportDetails.selectedTripIndex}
                        onChange={(e) =>
                          handleTripSelection(parseInt(e.target.value))
                        }
                        className="trip-select"
                      >
                        <option value="">Select Trip</option>
                        {selectedRouteSchedule.tripTimes.map((trip, idx) => (
                          <option key={idx} value={idx}>
                            Trip {trip.tripNumber}: {trip.departureTime} (
                            {trip.tripType})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Outbound Trip Details (Home -> Office) */}
                {employeeForm.transportDetails.selectedTripIndex !== "" &&
                  selectedRouteSchedule?.tripTimes && (
                    <div className="trip-assignment-section">
                      <div className="outbound-trip-section">
                        <h5 className="trip-section-title outbound-title">
                          Outbound Trip:{" "}
                          {selectedRouteSchedule.routeInfo?.fromLocation} &rarr;{" "}
                          {selectedRouteSchedule.routeInfo?.toLocation}
                        </h5>
                        <p className="trip-section-subtitle">
                          Morning commute - Employee travels from home to office
                        </p>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Pickup Stop (Near Home)</label>
                            <select
                              value={
                                employeeForm.transportDetails.outboundPickupStop
                              }
                              onChange={(e) =>
                                setEmployeeForm((prev) => ({
                                  ...prev,
                                  transportDetails: {
                                    ...prev.transportDetails,
                                    outboundPickupStop: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Select Pickup Stop</option>
                              {selectedRouteSchedule.tripTimes[
                                parseInt(
                                  employeeForm.transportDetails
                                    .selectedTripIndex,
                                )
                              ]?.outboundStopPoints?.map((stop, idx) => (
                                <option key={idx} value={stop.location}>
                                  {stop.location} ({stop.time})
                                </option>
                              ))}
                            </select>
                            {employeeForm.homeAddress && (
                              <small className="home-address-hint">
                                Employee Home: {employeeForm.homeAddress}
                              </small>
                            )}
                          </div>
                          <div className="form-group">
                            <label>Drop-off (Office)</label>
                            <input
                              type="text"
                              placeholder="Office Location"
                              value={
                                employeeForm.transportDetails
                                  .outboundDropoffStop ||
                                selectedRouteSchedule.routeInfo?.toLocation ||
                                ""
                              }
                              onChange={(e) =>
                                setEmployeeForm((prev) => ({
                                  ...prev,
                                  transportDetails: {
                                    ...prev.transportDetails,
                                    outboundDropoffStop: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Return Trip Details (Office -> Home) - Only for Round Trip */}
                      {employeeForm.transportDetails.tripType ===
                        "Round Trip" && (
                        <div className="return-trip-section">
                          <h5 className="trip-section-title return-title">
                            Return Trip:{" "}
                            {selectedRouteSchedule.routeInfo?.toLocation} &rarr;{" "}
                            {selectedRouteSchedule.routeInfo?.fromLocation}
                          </h5>
                          <p className="trip-section-subtitle">
                            Evening commute - Employee travels from office to
                            home
                          </p>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Pickup (Office)</label>
                              <input
                                type="text"
                                placeholder="Office Location"
                                value={
                                  employeeForm.transportDetails
                                    .returnPickupStop ||
                                  selectedRouteSchedule.routeInfo?.toLocation ||
                                  ""
                                }
                                onChange={(e) =>
                                  setEmployeeForm((prev) => ({
                                    ...prev,
                                    transportDetails: {
                                      ...prev.transportDetails,
                                      returnPickupStop: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label>Drop-off Stop (Near Home)</label>
                              <select
                                value={
                                  employeeForm.transportDetails
                                    .returnDropoffStop
                                }
                                onChange={(e) =>
                                  setEmployeeForm((prev) => ({
                                    ...prev,
                                    transportDetails: {
                                      ...prev.transportDetails,
                                      returnDropoffStop: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">Select Drop-off Stop</option>
                                {selectedRouteSchedule.tripTimes[
                                  parseInt(
                                    employeeForm.transportDetails
                                      .selectedTripIndex,
                                  )
                                ]?.returnStopPoints?.map((stop, idx) => (
                                  <option key={idx} value={stop.location}>
                                    {stop.location} ({stop.time})
                                  </option>
                                ))}
                              </select>
                              {employeeForm.homeAddress && (
                                <small className="home-address-hint">
                                  Employee Home: {employeeForm.homeAddress}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* One Way Trip Notice */}
                      {employeeForm.transportDetails.tripType === "One Way" && (
                        <div className="one-way-notice">
                          <p>
                            This is a One Way trip. Employee will only be
                            transported in one direction.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Pass Duration Section */}
              {employeeForm.transportDetails.assignedRoute && (
                <div className="form-section">
                  <h4>Pass Duration</h4>
                  <p className="section-description">
                    Specify how long this route should be assigned to the
                    employee
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Duration Type</label>
                      <select
                        value={
                          employeeForm.passDuration?.durationType || "1_MONTH"
                        }
                        onChange={(e) =>
                          setEmployeeForm((prev) => ({
                            ...prev,
                            passDuration: {
                              ...prev.passDuration,
                              durationType: e.target.value,
                              customEndDate:
                                e.target.value !== "CUSTOM"
                                  ? ""
                                  : prev.passDuration?.customEndDate,
                            },
                          }))
                        }
                      >
                        <option value="1_MONTH">1 Month</option>
                        <option value="2_MONTHS">2 Months</option>
                        <option value="3_MONTHS">3 Months</option>
                        <option value="6_MONTHS">6 Months</option>
                        <option value="1_YEAR">1 Year</option>
                        <option value="CUSTOM">Custom Date Range</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Pass Start Date</label>
                      <input
                        type="date"
                        value={
                          employeeForm.passDuration?.startDate ||
                          new Date().toISOString().split("T")[0]
                        }
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) =>
                          setEmployeeForm((prev) => ({
                            ...prev,
                            passDuration: {
                              ...prev.passDuration,
                              startDate: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {employeeForm.passDuration?.durationType === "CUSTOM" && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={employeeForm.passDuration?.customEndDate || ""}
                          min={
                            employeeForm.passDuration?.startDate ||
                            new Date().toISOString().split("T")[0]
                          }
                          onChange={(e) =>
                            setEmployeeForm((prev) => ({
                              ...prev,
                              passDuration: {
                                ...prev.passDuration,
                                customEndDate: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="pass-duration-info">
                    <div className="info-icon">i</div>
                    <p>
                      {employeeForm.passDuration?.durationType === "CUSTOM"
                        ? `Custom duration: ${employeeForm.passDuration?.startDate || "Start"} to ${employeeForm.passDuration?.customEndDate || "End"}`
                        : `Monthly pass will be created for ${
                            employeeForm.passDuration?.durationType ===
                            "1_MONTH"
                              ? "1 month"
                              : employeeForm.passDuration?.durationType ===
                                  "2_MONTHS"
                                ? "2 months"
                                : employeeForm.passDuration?.durationType ===
                                    "3_MONTHS"
                                  ? "3 months"
                                  : employeeForm.passDuration?.durationType ===
                                      "6_MONTHS"
                                    ? "6 months"
                                    : employeeForm.passDuration
                                          ?.durationType === "1_YEAR"
                                      ? "1 year"
                                      : "1 month"
                          } starting from ${employeeForm.passDuration?.startDate || "today"}. Trips will be auto-generated for the entire duration.`}
                    </p>
                  </div>
                </div>
              )}

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

      {/* View Employee Modal */}
      {selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Employee Details</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedEmployee(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="employee-details-grid">
                <div className="detail-section">
                  <h4>Personal Information</h4>
                  <p>
                    <strong>Name:</strong> {getEmployeeName(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Email:</strong> {getEmployeeEmail(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Phone:</strong> {getEmployeePhone(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Department:</strong>{" "}
                    {getEmployeeDepartment(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Designation:</strong>{" "}
                    {getEmployeeDesignation(selectedEmployee)}
                  </p>
                </div>
                <div className="detail-section">
                  <h4>Transport Details</h4>
                  <p>
                    <strong>Route:</strong> {getEmployeeRoute(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Trip Assignment:</strong>{" "}
                    {getEmployeeTripInfo(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Pickup Stop:</strong>{" "}
                    {selectedEmployee.transportDetails?.outboundPickupStop ||
                      "Not specified"}
                  </p>
                  <p>
                    <strong>Dropoff Stop:</strong>{" "}
                    {selectedEmployee.transportDetails?.outboundDropoffStop ||
                      "Not specified"}
                  </p>
                  {selectedEmployee.transportDetails?.assignedTripType ===
                    "Round Trip" && (
                    <>
                      <p>
                        <strong>Return Pickup:</strong>{" "}
                        {selectedEmployee.transportDetails?.returnPickupStop ||
                          "Office"}
                      </p>
                      <p>
                        <strong>Return Dropoff:</strong>{" "}
                        {selectedEmployee.transportDetails?.returnDropoffStop ||
                          "Home"}
                      </p>
                    </>
                  )}
                </div>
                <div className="detail-section">
                  <h4>Status</h4>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`status-badge ${getEmployeeStatus(selectedEmployee) ? "active" : "inactive"}`}
                    >
                      {getEmployeeStatus(selectedEmployee)
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </p>
                  <p>
                    <strong>Home Address:</strong>{" "}
                    {typeof selectedEmployee.homeAddress === "object" &&
                    selectedEmployee.homeAddress
                      ? [
                          selectedEmployee.homeAddress.street,
                          selectedEmployee.homeAddress.area,
                          selectedEmployee.homeAddress.city,
                          selectedEmployee.homeAddress.state,
                          selectedEmployee.homeAddress.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : typeof selectedEmployee.residentialAddress ===
                            "object" && selectedEmployee.residentialAddress
                        ? [
                            selectedEmployee.residentialAddress.street,
                            selectedEmployee.residentialAddress.area,
                            selectedEmployee.residentialAddress.city,
                            selectedEmployee.residentialAddress.state,
                            selectedEmployee.residentialAddress.postalCode,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : selectedEmployee.homeAddress ||
                          selectedEmployee.residentialAddress ||
                          "Not specified"}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CorporateEmployeeManagement;
