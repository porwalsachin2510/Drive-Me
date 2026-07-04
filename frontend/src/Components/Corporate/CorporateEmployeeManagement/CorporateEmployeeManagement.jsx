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
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteSchedule, setSelectedRouteSchedule] = useState(null);
  const [routeSchedulesLoading, setRouteSchedulesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dropdown options state for master data fields
  const [dropdownOptions, setDropdownOptions] = useState({
    departments: [],
    designations: [],
    workLocations: [],
    shiftTypes: [],
  });

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
    fetchDropdownOptions();
  }, [currentPage, searchTerm, filterStatus]);

  // Fetch dropdown options for master data fields (Department, Designation, Work Location)
  const fetchDropdownOptions = async () => {
    try {
      const response = await api.post("/dropdowns/multiple", {
        categories: [
          "DEPARTMENTS",
          "DESIGNATIONS",
          "WORK_LOCATIONS",
          "SHIFT_TYPES",
        ],
      });

      const dropdownData = response.data?.data?.dropdowns || {};
      setDropdownOptions({
        departments: dropdownData.DEPARTMENTS?.options || [],
        designations: dropdownData.DESIGNATIONS?.options || [],
        workLocations: dropdownData.WORK_LOCATIONS?.options || [],
        shiftTypes: dropdownData.SHIFT_TYPES?.options || [],
      });
    } catch (error) {
      console.error("Error fetching dropdown options:", error);
      // Set default options if API fails
      setDropdownOptions({
        departments: [],
        designations: [],
        workLocations: [],
        shiftTypes: [],
      });
    }
  };

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
  // If preserveExisting is true, it will keep existing transport details (used for editing)
  const fetchRouteSchedule = async (routeId, preserveExisting = false) => {
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

        // Only auto-select the first trip if not preserving existing (i.e., for new selection)
        if (
          !preserveExisting &&
          scheduleData.tripTimes &&
          scheduleData.tripTimes.length > 0
        ) {
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
        } else if (preserveExisting) {
          // When editing, update the tripType based on the selected trip from schedule
          setEmployeeForm((prev) => {
            const tripIdx =
              parseInt(prev.transportDetails.selectedTripIndex) || 0;
            const selectedTrip = scheduleData.tripTimes?.[tripIdx];
            if (selectedTrip) {
              // Always use the schedule's trip type as the source of truth
              return {
                ...prev,
                transportDetails: {
                  ...prev.transportDetails,
                  tripType:
                    selectedTrip.tripType ||
                    prev.transportDetails.tripType ||
                    "One Way",
                },
              };
            }
            return prev;
          });
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

  // const handleBulkUploadFile = async (e) => {
  //   const file = e.target.files[0];
  //   if (!file) return;

  //   const fileExtension = file.name.split(".").pop().toLowerCase();

  //   if (fileExtension === "xlsx" || fileExtension === "xls") {
  //     // Handle Excel file
  //     try {
  //       const xlsxModule = await import("xlsx");
  //       const XLSX = xlsxModule.default || xlsxModule;
  //       const reader = new FileReader();
  //       reader.onload = (event) => {
  //         try {
  //           const data = new Uint8Array(event.target.result);
  //           const workbook = XLSX.read(data, { type: "array" });
  //           const firstSheetName = workbook.SheetNames[0];
  //           const worksheet = workbook.Sheets[firstSheetName];
  //           const jsonData = XLSX.utils.sheet_to_json(worksheet);

  //           // Map Excel columns to expected format
  //           const employees = jsonData.map((row) => ({
  //             fullName: row["Full Name"] || row["fullName"] || "",
  //             email: row["Email"] || row["email"] || "",
  //             contactNumber:
  //               row["Phone"] ||
  //               row["Phone Number"] ||
  //               row["contactNumber"] ||
  //               "",
  //             department: row["Department"] || row["department"] || "",
  //             designation: row["Designation"] || row["designation"] || "",
  //             workLocation: row["Work Location"] || row["workLocation"] || "",
  //             homeAddress: row["Home Address"] || row["homeAddress"] || "",
  //             workShift: row["Work Shift"] || row["workShift"] || "FULL_DAY",
  //           }));

  //           setBulkUploadData({ employees });
  //         } catch (error) {
  //           console.error("Error parsing Excel:", error);
  //           alert("Invalid Excel file. Please check the format.");
  //         }
  //       };
  //       reader.readAsArrayBuffer(file);
  //     } catch (error) {
  //       console.error("Error loading xlsx library:", error);
  //       alert("Error processing Excel file");
  //     }
  //   } else if (fileExtension === "json") {
  //     // Handle JSON file (legacy support)
  //     const reader = new FileReader();
  //     reader.onload = (event) => {
  //       try {
  //         const jsonData = JSON.parse(event.target.result);
  //         setBulkUploadData({
  //           employees: Array.isArray(jsonData) ? jsonData : [jsonData],
  //         });
  //       } catch (error) {
  //         alert("Invalid JSON file");
  //       }
  //     };
  //     reader.readAsText(file);
  //   } else {
  //     alert("Please upload an Excel (.xlsx, .xls) file");
  //   }
  // };

  const handleBulkUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      // Handle Excel file
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = xlsxModule.default || xlsxModule;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Map Excel columns to expected format
            const employees = jsonData.map((row) => ({
              fullName: row["Full Name"] || row["fullName"] || "",
              email: row["Email"] || row["email"] || "",
              contactNumber:
                row["Phone"] ||
                row["Phone Number"] ||
                row["contactNumber"] ||
                "",
              department: row["Department"] || row["department"] || "",
              designation: row["Designation"] || row["designation"] || "",
              workLocation: row["Work Location"] || row["workLocation"] || "",
              homeAddress: row["Home Address"] || row["homeAddress"] || "",
              workShift: row["Work Shift"] || row["workShift"] || "FULL_DAY",
            }));

            setBulkUploadData({ employees });
          } catch (error) {
            console.error("Error parsing Excel:", error);
            alert("Invalid Excel file. Please check the format.");
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error loading xlsx library:", error);
        alert("Error processing Excel file");
      }
    } else if (fileExtension === "json") {
      // Handle JSON file (legacy support)
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          setBulkUploadData({
            employees: Array.isArray(jsonData) ? jsonData : [jsonData],
          });
        } catch (error) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else {
      alert("Please upload an Excel (.xlsx, .xls) file");
    }
  };

  const downloadSampleTemplate = async () => {
    try {
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default || xlsxModule;

      const sampleData = [
        {
          "Full Name": "John Doe",
          Email: "john@company.com",
          "Phone Number": "+1234567890",
          Department: "IT",
          Designation: "Software Engineer",
          "Work Location": "Main Office",
          "Home Address": "123 Main St, Downtown",
          "Work Shift": "FULL_DAY",
        },
        {
          "Full Name": "Jane Smith",
          Email: "jane@company.com",
          "Phone Number": "+0987654321",
          Department: "HR",
          Designation: "HR Manager",
          "Work Location": "Main Office",
          "Home Address": "456 Park Ave",
          "Work Shift": "FULL_DAY",
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

      // Set column widths
      worksheet["!cols"] = [
        { wch: 20 }, // Full Name
        { wch: 25 }, // Email
        { wch: 15 }, // Phone Number
        { wch: 15 }, // Department
        { wch: 20 }, // Designation
        { wch: 20 }, // Work Location
        { wch: 30 }, // Home Address
        { wch: 12 }, // Work Shift
      ];

      XLSX.writeFile(workbook, "employee_template.xlsx");
    } catch (error) {
      console.error("Error generating Excel template:", error);
      alert(
        "Error generating template. Please make sure xlsx package is installed.",
      );
    }
  };

  // Open Edit Modal and populate form with employee data
  const handleOpenEditModal = (employee) => {
    setEditingEmployee(employee);

    // Populate the form with employee data
    setEmployeeForm({
      personalInfo: {
        firstName: employee.personalInfo?.firstName || "",
        lastName: employee.personalInfo?.lastName || "",
        email: employee.personalInfo?.email || "",
        phoneNumber: employee.personalInfo?.phoneNumber || "",
        department: employee.personalInfo?.department || "",
        designation: employee.personalInfo?.designation || "",
        workLocation: employee.personalInfo?.workLocation || "",
      },
      homeAddress:
        typeof employee.homeAddress === "string" ? employee.homeAddress : "",
      residentialAddress: employee.residentialAddress || {
        street: "",
        area: "",
        city: "",
        state: "",
        postalCode: "",
      },
      transportDetails: {
        assignedRoute:
          employee.transportDetails?.assignedRoute?._id ||
          employee.transportDetails?.assignedRoute ||
          "",
        selectedTripIndex: employee.transportDetails?.assignedTripNumber
          ? String(employee.transportDetails.assignedTripNumber - 1)
          : "",
        tripType: employee.transportDetails?.assignedTripType || "",
        outboundPickupStop:
          employee.transportDetails?.outboundPickupStop ||
          employee.transportDetails?.pickupPoint ||
          "",
        outboundDropoffStop:
          employee.transportDetails?.outboundDropoffStop ||
          employee.transportDetails?.dropOffPoint ||
          "",
        returnPickupStop: employee.transportDetails?.returnPickupStop || "",
        returnDropoffStop: employee.transportDetails?.returnDropoffStop || "",
        shiftType: employee.transportDetails?.shiftType || "FULL_DAY",
      },
      passDuration: employee.passDuration || {
        durationType: "1_MONTH",
        startDate: new Date().toISOString().split("T")[0],
        customEndDate: "",
      },
    });

    // Fetch route schedule if route is assigned
    if (
      employee.transportDetails?.assignedRoute?._id ||
      employee.transportDetails?.assignedRoute
    ) {
      const routeId =
        employee.transportDetails?.assignedRoute?._id ||
        employee.transportDetails?.assignedRoute;
      fetchRouteSchedule(routeId);
    }

    setShowEditModal(true);
  };

  // Handle Edit Employee submission
  const handleEditEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      setLoading(true);

      const selectedTripIndex =
        employeeForm.transportDetails.selectedTripIndex !== ""
          ? parseInt(employeeForm.transportDetails.selectedTripIndex)
          : 0;
      const selectedTrip =
        selectedRouteSchedule?.tripTimes?.[selectedTripIndex];

      const updateData = {
        personalInfo: employeeForm.personalInfo,
        homeAddress: employeeForm.homeAddress,
        residentialAddress: employeeForm.residentialAddress,
        transportDetails: {
          assignedRoute:
            employeeForm.transportDetails.assignedRoute || undefined,
          pickupPoint: employeeForm.transportDetails.outboundPickupStop,
          dropOffPoint:
            employeeForm.transportDetails.outboundDropoffStop ||
            selectedRouteSchedule?.routeInfo?.toLocation,
          outboundPickupStop: employeeForm.transportDetails.outboundPickupStop,
          outboundDropoffStop:
            employeeForm.transportDetails.outboundDropoffStop ||
            selectedRouteSchedule?.routeInfo?.toLocation,
          returnPickupStop: employeeForm.transportDetails.returnPickupStop,
          returnDropoffStop: employeeForm.transportDetails.returnDropoffStop,
          shiftType: employeeForm.transportDetails.shiftType,
          assignedTripNumber:
            selectedTrip?.tripNumber ||
            employeeForm.transportDetails.selectedTripIndex
              ? parseInt(employeeForm.transportDetails.selectedTripIndex) + 1
              : 1,
          assignedTripType:
            selectedTrip?.tripType ||
            employeeForm.transportDetails.tripType ||
            "",
        },
      };

      await api.put(`/corporate-employees/${editingEmployee._id}`, updateData);

      setShowEditModal(false);
      setEditingEmployee(null);
      resetEmployeeForm();
      fetchEmployees();
      alert("Employee updated successfully!");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert(error.response?.data?.message || "Failed to update employee");
    } finally {
      setLoading(false);
    }
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
  const getEmployeeHomeAddress = (emp) => emp.homeAddress || "N/A";
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
    // Check if no route is assigned at all
    if (!td?.assignedRoute) return "Not Assigned";

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
    // Only show trip type if it's Round Trip (One Way is default, no need to show it)
    const pickup = td.outboundPickupStop || td.pickupPoint || "";
    if (tripType === "Round Trip") {
      return `Trip ${tripNum} (Round Trip)${pickup ? ` - ${pickup}` : ""}`;
    }
    // For One Way or no trip type, just show trip number and pickup
    return pickup ? `Trip ${tripNum} - ${pickup}` : `Trip ${tripNum}`;
  };

  const renderContent = () => {
    switch (activeTab) {
      case "list":
        return (
          <div className="drivemego-cem-employee-list">
            <div className="drivemego-cem-list-header">
              <div className="drivemego-cem-search-filters">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="drivemego-cem-search-input"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="drivemego-cem-filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="drivemego-cem-action-buttons">
                <button
                  className="drivemego-cem-btn drivemego-cem-btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Employee
                </button>
                <button
                  className="drivemego-cem-btn drivemego-cem-btn-secondary"
                  onClick={() => setShowBulkUploadModal(true)}
                >
                  Bulk Upload
                </button>
                {selectedEmployeeIds.length > 0 && (
                  <button
                    className="drivemego-cem-btn drivemego-cem-btn-success"
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
              <div className="drivemego-cem-loading">Loading employees...</div>
            ) : (
              <div className="drivemego-cem-employees-table">
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
                            <td className="drivemego-cem-trip-assignment-cell">
                              {getEmployeeTripInfo(employee)}
                            </td>
                            <td>
                              <span
                                className={`drivemego-cem-status-badge ${isActive ? "drivemego-cem-active" : "drivemego-cem-inactive"}`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className="drivemego-cem-action-buttons">
                                <button
                                  className="drivemego-cem-btn drivemego-cem-btn-sm drivemego-cem-btn-info"
                                  onClick={() => setSelectedEmployee(employee)}
                                >
                                  View
                                </button>
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleOpenEditModal(employee)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="drivemego-cem-btn drivemego-cem-btn-sm drivemego-cem-btn-danger"
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
              <div className="drivemego-cem-pagination">
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
    <div className="drivemego-cem-corporate-employee-management">
      <div className="drivemego-cem-management-header">
        <h2>Employee Management</h2>
        <div className="drivemego-cem-tab-navigation">
          <button
            className={`drivemego-cem-tab-btn ${activeTab === "list" ? "drivemego-cem-active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            Employee List
          </button>
        </div>
      </div>

      <div className="drivemego-cem-management-content">{renderContent()}</div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="drivemego-cem-modal-overlay">
          <div className="drivemego-cem-modal">
            <div className="drivemego-cem-modal-header">
              <h3>Add New Employee</h3>
              <button
                className="drivemego-cem-close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={handleAddEmployee}
              className="drivemego-cem-modal-form"
            >
              <div className="drivemego-cem-form-section">
                <h4>Personal Information</h4>
                <div className="drivemego-cem-form-row">
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
                <div className="drivemego-cem-form-row">
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
                <div className="drivemego-cem-form-row">
                  <select
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
                  >
                    <option value="">Select Department</option>
                    {dropdownOptions.departments.map((dept) => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                  <select
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
                  >
                    <option value="">Select Designation</option>
                    {dropdownOptions.designations.map((desig) => (
                      <option key={desig.value} value={desig.value}>
                        {desig.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="drivemego-cem-form-row">
                  <select
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
                  >
                    <option value="">Select Work Location</option>
                    {dropdownOptions.workLocations.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="drivemego-cem-form-row">
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
                    className="drivemego-cem-full-width-input"
                  />
                </div>
              </div>

              <div className="drivemego-cem-form-section">
                <h4>Transport Details</h4>
                <div className="drivemego-cem-form-row">
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
                  <div className="drivemego-cem-route-schedule-loading">
                    <p>Loading route schedule...</p>
                  </div>
                )}

                {selectedRouteSchedule && !routeSchedulesLoading && (
                  <div className="drivemego-cem-route-schedule-info">
                    <h5>Route Schedule</h5>
                    <div className="drivemego-cem-schedule-details">
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
                          <div className="drivemego-cem-trip-times-info">
                            <h6>Trip Times</h6>
                            {selectedRouteSchedule.tripTimes.map(
                              (trip, idx) => (
                                <div
                                  key={idx}
                                  className="drivemego-cem-trip-time-item"
                                >
                                  <p>
                                    <strong>Trip {trip.tripNumber}:</strong>{" "}
                                    {trip.departureTime} ({trip.tripType})
                                  </p>

                                  {/* Outbound (morning) leg: Home -> Office */}
                                  {trip.outboundStopPoints &&
                                    trip.outboundStopPoints.length > 0 && (
                                      <div className="drivemego-cem-stop-points-list-info">
                                        <span className="drivemego-cem-stop-label drivemego-cem-outbound">
                                          {trip.tripType === "Round Trip"
                                            ? "Outbound Pickup Stops (Home \u2192 Office):"
                                            : "Pickup Stops:"}
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

                                  {/* Return (evening) leg: Office -> Home. Only for Round Trip */}
                                  {trip.tripType === "Round Trip" && (
                                    <>
                                      <p className="drivemego-cem-return-departure-time">
                                        <strong>Return Departure:</strong>{" "}
                                        {trip.returnStartTime ||
                                          trip.returnDepartureTime ||
                                          "N/A"}
                                        {(trip.returnEndTime ||
                                          trip.returnArrivalTime) &&
                                          ` (arrives ${trip.returnEndTime || trip.returnArrivalTime})`}
                                      </p>
                                      {trip.returnStopPoints &&
                                        trip.returnStopPoints.length > 0 && (
                                          <div className="drivemego-cem-stop-points-list-info">
                                            <span className="drivemego-cem-stop-label drivemego-cem-return">
                                              Drop-off Stops (Office &rarr;
                                              Home):
                                            </span>
                                            <ul>
                                              {trip.returnStopPoints.map(
                                                (stop, sIdx) => (
                                                  <li key={sIdx}>
                                                    {stop.location} -{" "}
                                                    {stop.time}
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                    </>
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
                  <div className="drivemego-cem-trip-selection-section">
                    <h5>Select Trip to Assign</h5>
                    <div className="drivemego-cem-form-row">
                      <select
                        value={employeeForm.transportDetails.selectedTripIndex}
                        onChange={(e) =>
                          handleTripSelection(parseInt(e.target.value))
                        }
                        className="drivemego-cem-trip-select"
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
                    <div className="drivemego-cem-trip-assignment-section">
                      <div className="drivemego-cem-outbound-trip-section">
                        <h5 className="drivemego-cem-trip-section-title drivemego-cem-outbound-title">
                          Outbound Trip:{" "}
                          {selectedRouteSchedule.routeInfo?.fromLocation} &rarr;{" "}
                          {selectedRouteSchedule.routeInfo?.toLocation}
                        </h5>
                        <p className="drivemego-cem-trip-section-subtitle">
                          Morning commute - Employee travels from home to office
                        </p>

                        <div className="drivemego-cem-form-row">
                          <div className="drivemego-cem-form-group">
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
                              {/* Include route starting point as first pickup option */}
                              {selectedRouteSchedule.routeInfo
                                ?.fromLocation && (
                                <option
                                  value={
                                    selectedRouteSchedule.routeInfo.fromLocation
                                  }
                                >
                                  {selectedRouteSchedule.routeInfo.fromLocation}{" "}
                                  (Start Point -{" "}
                                  {selectedRouteSchedule.tripTimes[
                                    parseInt(
                                      employeeForm.transportDetails
                                        .selectedTripIndex,
                                    )
                                  ]?.departureTime || "Departure"}
                                  )
                                </option>
                              )}
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
                              <small className="drivemego-cem-home-address-hint">
                                Employee Home: {employeeForm.homeAddress}
                              </small>
                            )}
                          </div>
                          <div className="drivemego-cem-form-group">
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
                        <div className="drivemego-cem-return-trip-section">
                          <h5 className="drivemego-cem-trip-section-title drivemego-cem-return-title">
                            Return Trip:{" "}
                            {selectedRouteSchedule.routeInfo?.toLocation} &rarr;{" "}
                            {selectedRouteSchedule.routeInfo?.fromLocation}
                          </h5>
                          <p className="drivemego-cem-trip-section-subtitle">
                            Evening commute - Employee travels from office to
                            home
                          </p>

                          <div className="drivemego-cem-form-row">
                            <div className="drivemego-cem-form-group">
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
                            <div className="drivemego-cem-form-group">
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
                                {/* Include route starting point (original fromLocation) as final drop-off option */}
                                {selectedRouteSchedule.routeInfo
                                  ?.fromLocation && (
                                  <option
                                    value={
                                      selectedRouteSchedule.routeInfo
                                        .fromLocation
                                    }
                                  >
                                    {
                                      selectedRouteSchedule.routeInfo
                                        .fromLocation
                                    }{" "}
                                    (End Point -{" "}
                                    {selectedRouteSchedule.tripTimes[
                                      parseInt(
                                        employeeForm.transportDetails
                                          .selectedTripIndex,
                                      )
                                    ]?.returnArrivalTime || "Arrival"}
                                    )
                                  </option>
                                )}
                              </select>
                              {employeeForm.homeAddress && (
                                <small className="drivemego-cem-home-address-hint">
                                  Employee Home: {employeeForm.homeAddress}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* One Way Trip Notice */}
                      {employeeForm.transportDetails.tripType === "One Way" && (
                        <div className="drivemego-cem-one-way-notice">
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
                <div className="drivemego-cem-form-section">
                  <h4>Pass Duration</h4>
                  <p className="drivemego-cem-section-description">
                    Specify how long this route should be assigned to the
                    employee
                  </p>

                  <div className="drivemego-cem-form-row">
                    <div className="drivemego-cem-form-group">
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
                    <div className="drivemego-cem-form-group">
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
                    <div className="drivemego-cem-form-row">
                      <div className="drivemego-cem-form-group">
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

                  <div className="drivemego-cem-pass-duration-info">
                    <div className="drivemego-cem-info-icon">i</div>
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

              <div className="drivemego-cem-modal-actions">
                <button
                  type="button"
                  className="drivemego-cem-btn drivemego-cem-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-cem-btn drivemego-cem-btn-primary"
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
        <div className="drivemego-cem-modal-overlay">
          <div className="drivemego-cem-modal">
            <div className="drivemego-cem-modal-header">
              <h3>Bulk Upload Employees</h3>
              <button
                className="drivemego-cem-close-btn"
                onClick={() => setShowBulkUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="drivemego-cem-modal-content">
              <div className="drivemego-cem-bulk-upload-instructions">
                <h4>Instructions:</h4>
                <ol>
                  <li>Download the Excel template below</li>
                  <li>Fill in employee details in the spreadsheet</li>
                  <li>Upload the completed Excel file</li>
                </ol>
                <button
                  type="button"
                  className="drivemego-cem-btn drivemego-cem-btn-info"
                  onClick={downloadSampleTemplate}
                >
                  📥 Download Excel Template
                </button>
              </div>

              <form
                onSubmit={handleBulkUpload}
                className="drivemego-cem-modal-form"
              >
                <div className="drivemego-cem-form-group">
                  <label>Upload Excel File (.xlsx)</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUploadFile}
                    required
                  />
                </div>

                {bulkUploadData.employees.length > 0 && (
                  <div className="drivemego-cem-upload-preview">
                    <h4>
                      Preview ({bulkUploadData.employees.length} employees)
                    </h4>
                    <div className="drivemego-cem-preview-list">
                      {bulkUploadData.employees
                        .slice(0, 5)
                        .map((emp, index) => (
                          <div
                            key={index}
                            className="drivemego-cem-preview-item"
                          >
                            {emp.fullName ||
                              `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`}{" "}
                            - {emp.email || emp.personalInfo?.email || "N/A"}
                          </div>
                        ))}
                      {bulkUploadData.employees.length > 5 && (
                        <div className="drivemego-cem-preview-item">
                          ... and {bulkUploadData.employees.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="drivemego-cem-modal-actions">
                  <button
                    type="button"
                    className="drivemego-cem-btn drivemego-cem-btn-secondary"
                    onClick={() => setShowBulkUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="drivemego-cem-btn drivemego-cem-btn-primary"
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
        <div className="drivemego-cem-modal-overlay">
          <div className="drivemego-cem-modal">
            <div className="drivemego-cem-modal-header">
              <h3>Employee Details</h3>
              <button
                className="drivemego-cem-close-btn"
                onClick={() => setSelectedEmployee(null)}
              >
                ×
              </button>
            </div>
            <div className="drivemego-cem-modal-content">
              <div className="drivemego-cem-employee-details-grid">
                <div className="drivemego-cem-detail-section">
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
                <div className="drivemego-cem-detail-section">
                  <h4>Transport Details</h4>
                  <p>
                    <strong>Route:</strong> {getEmployeeRoute(selectedEmployee)}
                  </p>
                  <p>
                    <strong>Trip Assignment:</strong>{" "}
                    {selectedEmployee.transportDetails?.assignedRoute
                      ? `Trip ${selectedEmployee.transportDetails?.assignedTripNumber || 1}${selectedEmployee.transportDetails?.assignedTripType && selectedEmployee.transportDetails.assignedTripType !== "One Way" ? ` (${selectedEmployee.transportDetails.assignedTripType})` : ""}`
                      : "Not Assigned"}
                  </p>
                  <p>
                    <strong>Pickup Stop:</strong>{" "}
                    {selectedEmployee.transportDetails?.outboundPickupStop ||
                      selectedEmployee.transportDetails?.pickupPoint ||
                      (selectedEmployee.transportDetails?.assignedRoute
                        ? "Not specified"
                        : "N/A")}
                  </p>
                  <p>
                    <strong>Dropoff Stop:</strong>{" "}
                    {selectedEmployee.transportDetails?.outboundDropoffStop ||
                      selectedEmployee.transportDetails?.dropOffPoint ||
                      selectedEmployee.transportDetails?.assignedRoute
                        ?.toLocation ||
                      (selectedEmployee.transportDetails?.assignedRoute
                        ? "Not specified"
                        : "N/A")}
                  </p>
                  {(selectedEmployee.transportDetails?.assignedTripType ===
                    "Round Trip" ||
                    selectedEmployee.transportDetails?.returnPickupStop ||
                    selectedEmployee.transportDetails?.returnDropoffStop) && (
                    <>
                      <p>
                        <strong>Return Pickup:</strong>{" "}
                        {selectedEmployee.transportDetails?.returnPickupStop ||
                          selectedEmployee.transportDetails?.assignedRoute
                            ?.toLocation ||
                          "Office"}
                      </p>
                      <p>
                        <strong>Return Dropoff:</strong>{" "}
                        {selectedEmployee.transportDetails?.returnDropoffStop ||
                          selectedEmployee.transportDetails
                            ?.outboundPickupStop ||
                          selectedEmployee.transportDetails?.pickupPoint ||
                          "Home"}
                      </p>
                    </>
                  )}
                </div>
                <div className="drivemego-cem-detail-section">
                  <h4>Status</h4>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`drivemego-cem-status-badge ${getEmployeeStatus(selectedEmployee) ? "drivemego-cem-active" : "drivemego-cem-inactive"}`}
                    >
                      {getEmployeeStatus(selectedEmployee)
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </p>
                  <p>
                    <strong>Home Address:</strong>{" "}
                    <span>{getEmployeeHomeAddress(selectedEmployee)}</span>
                    {/* {typeof selectedEmployee.homeAddress === "object" &&
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
                          "Not specified"} */}
                  </p>
                </div>
              </div>
            </div>
            <div className="drivemego-cem-modal-actions">
              <button
                type="button"
                className="drivemego-cem-btn drivemego-cem-btn-secondary"
                onClick={() => setSelectedEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="drivemego-cem-modal-overlay">
          <div className="drivemego-cem-modal drivemego-cem-modal-large">
            <div className="drivemego-cem-modal-header">
              <h3>Edit Employee</h3>
              <button
                className="drivemego-cem-close-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                  resetEmployeeForm();
                }}
              >
                x
              </button>
            </div>
            <form
              onSubmit={handleEditEmployee}
              className="drivemego-cem-modal-form"
            >
              <div className="drivemego-cem-form-section">
                <h4>Personal Information</h4>
                <div className="drivemego-cem-form-row">
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
                <div className="drivemego-cem-form-row">
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
                <div className="drivemego-cem-form-row">
                  <select
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
                  >
                    <option value="">Select Department</option>
                    {dropdownOptions.departments.map((dept) => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                  <select
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
                  >
                    <option value="">Select Designation</option>
                    {dropdownOptions.designations.map((desig) => (
                      <option key={desig.value} value={desig.value}>
                        {desig.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="drivemego-cem-form-row">
                  <select
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
                  >
                    <option value="">Select Work Location</option>
                    {dropdownOptions.workLocations.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="drivemego-cem-form-row">
                  <input
                    type="text"
                    placeholder="Home Address"
                    value={employeeForm.homeAddress}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        homeAddress: e.target.value,
                      }))
                    }
                    className="drivemego-cem-full-width-input"
                  />
                </div>
              </div>

              <div className="drivemego-cem-form-section">
                <h4>Transport Details (Assign/Change Route)</h4>
                <div className="drivemego-cem-form-row">
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
                  <div className="drivemego-cem-route-schedule-loading">
                    <p>Loading route schedule...</p>
                  </div>
                )}

                {selectedRouteSchedule && !routeSchedulesLoading && (
                  <div className="drivemego-cem-route-schedule-info">
                    <h5>Route Schedule</h5>
                    <div className="drivemego-cem-schedule-details">
                      <p>
                        <strong>Route:</strong>{" "}
                        {selectedRouteSchedule.routeInfo?.fromLocation} to{" "}
                        {selectedRouteSchedule.routeInfo?.toLocation}
                      </p>
                      <p>
                        <strong>Available Days:</strong>{" "}
                        {selectedRouteSchedule.availableDays?.join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Trip Selection */}
                {selectedRouteSchedule?.tripTimes?.length > 0 && (
                  <div className="drivemego-cem-trip-selection-section">
                    <h5>Select Trip to Assign</h5>
                    <div className="drivemego-cem-form-row">
                      <select
                        value={employeeForm.transportDetails.selectedTripIndex}
                        onChange={(e) =>
                          handleTripSelection(parseInt(e.target.value))
                        }
                        className="drivemego-cem-trip-select"
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

                {/* Outbound Trip Details */}
                {employeeForm.transportDetails.selectedTripIndex !== "" &&
                  selectedRouteSchedule?.tripTimes && (
                    <div className="drivemego-cem-trip-assignment-section">
                      <div className="drivemego-cem-outbound-trip-section">
                        <h5 className="drivemego-cem-trip-section-title drivemego-cem-outbound-title">
                          Outbound Trip:{" "}
                          {selectedRouteSchedule.routeInfo?.fromLocation} to{" "}
                          {selectedRouteSchedule.routeInfo?.toLocation}
                        </h5>

                        <div className="drivemego-cem-form-row">
                          <div className="drivemego-cem-form-group">
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
                              {/* Include route starting point as first pickup option */}
                              {selectedRouteSchedule.routeInfo
                                ?.fromLocation && (
                                <option
                                  value={
                                    selectedRouteSchedule.routeInfo.fromLocation
                                  }
                                >
                                  {selectedRouteSchedule.routeInfo.fromLocation}{" "}
                                  (Start Point -{" "}
                                  {selectedRouteSchedule.tripTimes[
                                    parseInt(
                                      employeeForm.transportDetails
                                        .selectedTripIndex,
                                    )
                                  ]?.departureTime || "Departure"}
                                  )
                                </option>
                              )}
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
                          </div>
                          <div className="drivemego-cem-form-group">
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

                      {/* Return Trip Details - Only for Round Trip */}
                      {employeeForm.transportDetails.tripType ===
                        "Round Trip" && (
                        <div className="drivemego-cem-return-trip-section">
                          <h5 className="drivemego-cem-trip-section-title drivemego-cem-return-title">
                            Return Trip:{" "}
                            {selectedRouteSchedule.routeInfo?.toLocation} to{" "}
                            {selectedRouteSchedule.routeInfo?.fromLocation}
                          </h5>

                          <div className="drivemego-cem-form-row">
                            <div className="drivemego-cem-form-group">
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
                            <div className="drivemego-cem-form-group">
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
                                {/* Use returnStopPoints if available, otherwise use outboundStopPoints as fallback */}
                                {(
                                  selectedRouteSchedule.tripTimes[
                                    parseInt(
                                      employeeForm.transportDetails
                                        .selectedTripIndex,
                                    )
                                  ]?.returnStopPoints ||
                                  selectedRouteSchedule.tripTimes[
                                    parseInt(
                                      employeeForm.transportDetails
                                        .selectedTripIndex,
                                    )
                                  ]?.outboundStopPoints ||
                                  []
                                )?.map((stop, idx) => (
                                  <option key={idx} value={stop.location}>
                                    {stop.location} ({stop.time})
                                  </option>
                                ))}
                                {/* Include route starting point (original fromLocation) as final drop-off option */}
                                {selectedRouteSchedule.routeInfo
                                  ?.fromLocation && (
                                  <option
                                    value={
                                      selectedRouteSchedule.routeInfo
                                        .fromLocation
                                    }
                                  >
                                    {
                                      selectedRouteSchedule.routeInfo
                                        .fromLocation
                                    }{" "}
                                    (End Point -{" "}
                                    {selectedRouteSchedule.tripTimes[
                                      parseInt(
                                        employeeForm.transportDetails
                                          .selectedTripIndex,
                                      )
                                    ]?.returnArrivalTime || "Arrival"}
                                    )
                                  </option>
                                )}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="drivemego-cem-modal-actions">
                <button
                  type="button"
                  className="drivemego-cem-btn drivemego-cem-btn-secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEmployee(null);
                    resetEmployeeForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-cem-btn drivemego-cem-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CorporateEmployeeManagement;
