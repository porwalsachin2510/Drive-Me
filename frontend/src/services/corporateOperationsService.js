import api from "../utils/api";

// Daily trips for corporate
export const getDailyTrips = async (date) => {
  try {
    const response = await api.get("/corporate-operations/daily-trips", {
      params: { date }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching daily trips:", error);
    throw error;
  }
};

// Get trip details with passengers
export const getTripDetails = async (tripId) => {
  try {
    const response = await api.get(`/corporate-operations/trips/${tripId}/details`);
    return response.data;
  } catch (error) {
    console.error("Error fetching trip details:", error);
    throw error;
  }
};

// Get assigned vehicles
export const getAssignedVehicles = async () => {
  try {
    const response = await api.get("/corporate-operations/assigned-routes-status");
    return response.data;
  } catch (error) {
    console.error("Error fetching assigned vehicles:", error);
    throw error;
  }
};

// Get vehicle details
export const getVehicleDetails = async (vehicleId) => {
  try {
    const response = await api.get(`/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicle details:", error);
    throw error;
  }
};

// Get employee routes
export const getEmployeeRoutes = async () => {
  try {
    const response = await api.get("/corporate-operations/assigned-routes-status");
    return response.data;
  } catch (error) {
    console.error("Error fetching employee routes:", error);
    throw error;
  }
};

// Get contract routes
export const getContractRoutes = async (contractId) => {
  try {
    const response = await api.get(`/contracts/routes/${contractId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching contract routes:", error);
    throw error;
  }
};

// Assign route to vehicle for a contract
export const assignRouteToVehicle = async (contractId, assignedVehicleId, routeData) => {
  try {
    const response = await api.post(`/contracts/assign-route/${contractId}/${assignedVehicleId}`, routeData);
    return response.data;
  } catch (error) {
    console.error("Error assigning route to vehicle:", error);
    throw error;
  }
};

// Bulk upload employees
export const bulkUploadEmployees = async (employees) => {
  try {
    const response = await api.post("/corporate-employees/bulk-upload", {
      employees
    });
    return response.data;
  } catch (error) {
    console.error("Error uploading employees:", error);
    throw error;
  }
};

// Get employees
export const getEmployees = async (filters = {}) => {
  try {
    const response = await api.get("/corporate-employees", { params: filters });
    return response.data;
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error;
  }
};

// Get employee details - fetch all and filter
// Backend: GET /api/corporate-employees/ (corporateEmployeeRoutes.js)
export const getEmployeeDetails = async (employeeId) => {
  try {
    const response = await api.get(`/corporate-employees`, {
      params: { employeeId }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching employee details:", error);
    throw error;
  }
};

// Update employee
export const updateEmployee = async (employeeId, employeeData) => {
  try {
    const response = await api.put(
      `/corporate-employees/${employeeId}`,
      employeeData
    );
    return response.data;
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
};

// Delete employee
export const deleteEmployee = async (employeeId) => {
  try {
    const response = await api.delete(`/corporate-employees/${employeeId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
};

// Assign employees to trip
export const assignEmployeesToTrip = async (tripId, employeeIds) => {
  try {
    const response = await api.post(`/corporate-operations/trips/${tripId}/assign-employees`, {
      employeeIds
    });
    return response.data;
  } catch (error) {
    console.error("Error assigning employees:", error);
    throw error;
  }
};

// Get employee attendance report
export const getAttendanceReport = async (filters = {}) => {
  try {
    const response = await api.get("/corporate-employees/attendance", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    throw error;
  }
};

// Get contracts for corporate owner
export const getContracts = async (status = "") => {
  try {
    const response = await api.get("/contracts/corporate/all", {
      params: { status }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching contracts:", error);
    throw error;
  }
};

// Get contract details
export const getContractDetails = async (contractId) => {
  try {
    const response = await api.get(`/contracts/${contractId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching contract details:", error);
    throw error;
  }
};

// Corporate accept contract
// Backend: POST /api/contracts/:contractId/corporate-accept (contractRoutes.js)
export const corporateAcceptContract = async (contractId, acceptanceNotes = "") => {
  try {
    const response = await api.post(
      `/contracts/${contractId}/corporate-accept`,
      { acceptanceNotes }
    );
    return response.data;
  } catch (error) {
    console.error("Error accepting contract:", error);
    throw error;
  }
};

// Corporate reject contract
// Backend: POST /api/contracts/:contractId/corporate-reject (contractRoutes.js)
export const corporateRejectContract = async (contractId, rejectionReason) => {
  try {
    const response = await api.post(
      `/contracts/${contractId}/corporate-reject`,
      { rejectionReason }
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting contract:", error);
    throw error;
  }
};

// Renew subscription
// Backend: POST /api/subscription-settings/renew (subscriptionSettingsRoutes.js)
export const renewSubscription = async (paymentMethod) => {
  try {
    const response = await api.post("/subscription-settings/renew", { paymentMethod });
    return response.data;
  } catch (error) {
    console.error("Error renewing subscription:", error);
    throw error;
  }
};

// Get employee bookings (corporate operations)
// Backend: GET /api/corporate-operations/bookings (corporateOperationsRoutes.js)
export const getCorporateEmployeeBookings = async (filters = {}) => {
  try {
    const response = await api.get("/corporate-operations/bookings", { params: filters });
    return response.data;
  } catch (error) {
    console.error("Error fetching employee bookings:", error);
    throw error;
  }
};

// Get driver location by ID (for tracking)
// Backend: GET /api/driver/location/:driverId (driverLocationRoutes.js)
export const getDriverLocation = async (driverId) => {
  try {
    const response = await api.get(`/driver/location/${driverId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching driver location:", error);
    throw error;
  }
};

// Get quotations for corporate owner
export const getQuotations = async () => {
  try {
    const response = await api.post("/quotations/getcorporateownerquotations");
    return response.data;
  } catch (error) {
    console.error("Error fetching quotations:", error);
    throw error;
  }
};

// Negotiate quotation price
// Backend: POST /api/quotations/corporate/:quotationId/negotiate (quotationRoutes.js)
export const negotiateQuotation = async (quotationId, counterOffer, message) => {
  try {
    const response = await api.post(
      `/quotations/corporate/${quotationId}/negotiate`,
      { counterOffer, message }
    );
    return response.data;
  } catch (error) {
    console.error("Error negotiating quotation:", error);
    throw error;
  }
};

// Accept/reject quotation
export const acceptQuotation = async (quotationId, decision = "ACCEPTED") => {
  try {
    const response = await api.post(
      `/quotations/corporate/${quotationId}/decision`,
      { decision }
    );
    return response.data;
  } catch (error) {
    console.error("Error accepting quotation:", error);
    throw error;
  }
};

// Get requirements for corporate
export const getRequirements = async () => {
  try {
    const response = await api.get("/requirements/corporate");
    return response.data;
  } catch (error) {
    console.error("Error fetching requirements:", error);
    throw error;
  }
};

// Create requirement
export const createRequirement = async (requirementData) => {
  try {
    const response = await api.post("/requirements", requirementData);
    return response.data;
  } catch (error) {
    console.error("Error creating requirement:", error);
    throw error;
  }
};

// Get corporate profile
export const getCorporateProfile = async () => {
  try {
    const response = await api.get("/users/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching corporate profile:", error);
    throw error;
  }
};

// Update corporate profile
export const updateCorporateProfile = async (profileData) => {
  try {
    const response = await api.put("/users/profile", profileData);
    return response.data;
  } catch (error) {
    console.error("Error updating corporate profile:", error);
    throw error;
  }
};

// Get route utilization analytics
export const getPerformanceAnalytics = async (period = "monthly") => {
  try {
    const response = await api.get("/corporate-employees/route-utilization", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    throw error;
  }
};

// Get cost analysis via finance metrics
export const getCostAnalysis = async (dateRange = {}) => {
  try {
    const response = await api.get("/wallet/statement", {
      params: dateRange
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching cost analysis:", error);
    throw error;
  }
};

export default {
  getDailyTrips,
  getTripDetails,
  getAssignedVehicles,
  getVehicleDetails,
  getEmployeeRoutes,
  getContractRoutes,
  assignRouteToVehicle,
  bulkUploadEmployees,
  getEmployees,
  getEmployeeDetails,
  updateEmployee,
  deleteEmployee,
  assignEmployeesToTrip,
  getAttendanceReport,
  getContracts,
  getContractDetails,
  corporateAcceptContract,
  corporateRejectContract,
  negotiateQuotation,
  getQuotations,
  acceptQuotation,
  renewSubscription,
  getCorporateEmployeeBookings,
  getDriverLocation,
  getRequirements,
  createRequirement,
  getCorporateProfile,
  updateCorporateProfile,
  getPerformanceAnalytics,
  getCostAnalysis
};
