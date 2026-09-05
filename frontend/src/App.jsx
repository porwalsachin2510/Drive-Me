import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Provider, useDispatch, useSelector } from "react-redux";
import store from "./Redux/store";
import { initLocale } from "./Redux/slices/localeSlice";
import { SocketProvider } from "./context/SocketContext";
import { Toaster } from "react-hot-toast";
import HomePage from "./Pages/HomePage/index";
import CommuterProfilePage from "./Pages/CommuterPages/CommuterProfilePage/CommuterProfilePage";
import Login from "./Pages/Login/Login";
import Register from "./Pages/Register/Register";
import ProtectedRoleBasedRoute from "./Components/ProtectedRoleBasedRoute/ProtectedRoleBasedRoute";
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute";
import ProtectedAdminRoleBasedRoute from "./Components/ProtectedAdminRoleBasedRoute/ProtectedAdminRoleBasedRoute";
import PublicRoute from "./Components/PublicRoute/PublicRoute";
import CommuterContractPage from "./Pages/CommuterPages/CommuterContractPage/CommuterContractPage";
import B2C_PartnerProfilePage from "./Pages/B2C_PartnerPages/B2C_PartnerProfilePage/B2C_PartnerProfilePage";
import B2C_PartnerContractPage from "./Pages/B2C_PartnerPages/B2C_ParnterContractPage/B2C_PartnerContractPage";
import B2B_PartnerProfilePage from "./Pages/B2B_PartnerPages/B2B_PartnerProfilePage/B2B_PartnerProfilePage";
import B2B_PartnerContractPage from "./Pages/B2B_PartnerPages/B2B_ParnterContractPage/B2B_PartnerContractPage";
import CorporateProfilePage from "./Pages/CorporatePages/CorporateProfilePage/CorporateProfilePage";
import CorporateContractPage from "./Pages/CorporatePages/CorporateContractPage/CorporateContractPage";
import PublicAdminRoute from "./Components/PublicAdminRoute/PublicAdminRoute";
import AdminLoginPage from "./Pages/AdminPages/AdminLoginPage/AdminLoginPage";
import AdminDashboardPage from "./Pages/AdminPages/AdminDashboardPage/AdminDashboardPage";
import PaymentVerification from "./Pages/AdminPages/AdminPaymentVerification/PaymentVerification";
import Corporate from "./Pages/CorporatePages/Corporate/Corporate";
import ServiceSelection from "./Pages/CorporatePages/ServiceSelection/ServiceSelection";
import SearchResults from "./Pages/CorporatePages/SearchResults/SearchResults";
import VehicleDetails from "./Pages/CorporatePages/VehicleDetails/VehicleDetails";
import FleetOwnerPortfolio from "./Pages/CorporatePages/FleetOwnerPortfolio/FleetOwnerPortfolio";
import SingleVehicleOwnerDetails from "./Pages/CorporatePages/SingleVehicleOwnerDetails/SingleVehicleOwnerDetails";
import RequestReview from "./Pages/CorporatePages/RequestReview/RequestReview";
import MyQuotations from "./Pages/CorporatePages/MyQuotations/MyQuotations";
import QuotationDetails from "./Pages/CorporatePages/QuotationDetails/QuotationDetails";
import CorporateContractDetails from "./Pages/CorporatePages/CorporateContractDetails/CorporateContractDetails";
import B2B_PartnerContractDetails from "./Pages/B2B_PartnerPages/B2B_PartnerContractDetails/B2B_PartnerContractDetails";
import PaymentCallback from "./Pages/PaymentCallback/PaymentCallback";
import EMIPaymentCallback from "./Pages/EMIPaymentCallback/EMIPaymentCallback";
import B2B_PartnerAssignmentUI from "./Pages/B2B_PartnerPages/B2B_PartnerAssignmentUI/B2B_PartnerAssignmentUI";
import B2B_PartnerVehicleAssignmentList from "./Pages/B2B_PartnerPages/B2B_PartnerVehicleAssignment/B2B_PartnerVehicleAssignmentList";
import B2B_PartnerVehicleAssignmentForm from "./Pages/B2B_PartnerPages/B2B_PartnerVehicleAssignmentForm/B2B_PartnerVehicleAssignmentForm";
import B2B_PartnerAssignedVehicles from "./Pages/B2B_PartnerPages/B2B_PartnerAssignedVehicles/B2B_PartnerAssignedVehicles";
import CorporateAssignedVehiclesPage from "./Pages/CorporatePages/CorporateAssignedVehiclesPage/CorporateAssignedVehiclesPage";
import CorporateEmployeeBookingsPage from "./Pages/CorporatePages/CorporateEmployeeBookingsPage/CorporateEmployeeBookingsPage";
import B2C_PartnerBookingsPage from "./Pages/B2C_PartnerPages/B2C_PartnerBookingsPage/B2C_PartnerBookingsPage";
import CommuterMyBookingsPage from "./Pages/CommuterPages/CommuterMyBookingsPage/CommuterMyBookingsPage";
import CommuterBookingDetailsPage from "./Pages/CommuterPages/CommuterBookingDetailsPage/CommuterBookingDetailsPage";
import WalletPage from "./Pages/CommuterPages/WalletPage/WalletPage";
import WalletPaymentCallback from "./Pages/CommuterPages/WalletPage/WalletPaymentCallback";
import CorporateEmployeeDashboard from "./Pages/CommuterPages/CorporateEmployeeDashboard/CorporateEmployeeDashboard";
import CorporateEmployeeManagementPage from "./Pages/CorporatePages/CorporateEmployeeManagementPage/CorporateEmployeeManagementPage";
import EmployeeDashboard from "./Pages/CommuterPages/EmployeeDashboard/EmployeeDashboard";
import B2CPartnerDriverDashboard from "./Pages/DriverPages/B2CPartnerDriverDashboard/B2CPartnerDriverDashboard";
import B2BPartnerDriverDashboard from "./Pages/DriverPages/B2BPartnerDriverDashboard/B2BPartnerDriverDashboard";
import B2BManagedOperations from "./Pages/B2BPages/B2BManagedOperations/B2BManagedOperations";
import CorporateDriverDashboard from "./Pages/DriverPages/CorporateDriverDashboard/CorporateDriverDashboard";
import DriverLocationTracking from "./Pages/DriverPages/DriverLocationTracking/DriverLocationTracking";
import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";
import StaffLogin from "./Pages/StaffPortal/StaffLogin";
import StaffPortalGuard from "./Pages/StaffPortal/StaffPortalGuard";
import FieldPortal from "./Pages/StaffPortal/FieldPortal";
import FinancePortal from "./Pages/StaffPortal/FinancePortal";
import EnquiryForm from "./Pages/PublicEnquiry/EnquiryForm";
import SetPassword from "./Pages/SetPassword/SetPassword";
import DynamicPage from "./Pages/DynamicPage/DynamicPage";
import ForgotPassword from "./Pages/ForgotPassword/ForgotPassword";
import NotificationsPage from "./Pages/NotificationsPage/NotificationsPage";

// Bootstraps the user's locale (country -> currency -> payment gateway) once on
// load, and re-runs whenever auth state changes so the locale follows the
// logged-in user's saved country (source of truth) or the detected location.
function LocaleInitializer() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    dispatch(initLocale());
  }, [dispatch, isAuthenticated]);

  return null;
}

function App() {
  return (
    <Provider store={store}>
      <LocaleInitializer />
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <SocketProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* ===== Public lead-capture enquiry form (no auth) ===== */}
          <Route path="/enquiry/:slug" element={<EnquiryForm />} />

          {/* ===== Demand Generation Staff Portal (field reps & finance) ===== */}
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route
            path="/staff/field"
            element={
              <StaffPortalGuard role="FIELD">
                <FieldPortal />
              </StaffPortalGuard>
            }
          />
          <Route
            path="/staff/finance"
            element={
              <StaffPortalGuard role="FINANCE">
                <FinancePortal />
              </StaffPortalGuard>
            }
          />
          <Route
            path="/commuter-profile"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["COMMUTER"]}>
                <CommuterProfilePage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/commuter/mybookings"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["COMMUTER"]}>
                <CommuterMyBookingsPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/commuter/my-bookings/:bookingId"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["COMMUTER"]}>
                <CommuterBookingDetailsPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/add-funds"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/withdraw"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/transactions"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/payment/verify"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "SCHOOL_PARTNER"]}
              >
                <WalletPaymentCallback />
              </ProtectedRoleBasedRoute>
            }
          />

          {/* Notifications Page - All authenticated users */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={[
                  "COMMUTER",
                  "B2C_PARTNER",
                  "B2B_PARTNER",
                  "CORPORATE",
                  "CORPORATE_EMPLOYEE",
                  "SCHOOL_CUSTOMER",
                  "SCHOOL_PARTNER",
                  "SCHOOL_STUDENT",
                  "B2C_PARTNER_DRIVER",
                  "B2B_PARTNER_DRIVER",
                  "CORPORATE_DRIVER",
                  "SCHOOL_PARTNER_DRIVER",
                  "SCHOOL_CUSTOMER_DRIVER",
                  "ADMIN",
                ]}
              >
                <NotificationsPage />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["CORPORATE_EMPLOYEE", "SCHOOL_STUDENT"]}
              >
                <EmployeeDashboard />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/employee/dashboard-old"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["CORPORATE_EMPLOYEE", "SCHOOL_STUDENT"]}
              >
                <CorporateEmployeeDashboard />
              </ProtectedRoleBasedRoute>
            }
          />

          {/* Public Corporate Flow - accessible without login */}
          <Route path="/service-selection" element={<ServiceSelection />} />
          <Route path="/corporate" element={<Corporate />} />
          <Route path="/search-results" element={<SearchResults />} />

          {/* Protected - requires login to view vehicle owner details */}
          <Route
            path="/view-single-vehicle-owner"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <SingleVehicleOwnerDetails />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/request-review"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <RequestReview />
              </ProtectedRoleBasedRoute>
            }
          />
          {/* <Route
            path="/my-quotations"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <MyQuotations />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="/quotation/:id"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <QuotationDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corporate/contracts"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateContractPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corporate/contracts/:id"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateContractDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicle/:id"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <VehicleDetails />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/fleet-portfolio/:id"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <FleetOwnerPortfolio />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/commuter-profile/contract"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["COMMUTER"]}>
                <CommuterContractPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2c-partner-profile"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2C_PARTNER"]}>
                <B2C_PartnerProfilePage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2c-partner/bookings"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2C_PARTNER"]}>
                <B2C_PartnerBookingsPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2c-partner-profile/contract"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2C_PARTNER"]}>
                <B2C_PartnerContractPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner-profile"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerProfilePage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner/contracts"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerContractPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner/contracts/:id"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerContractDetails />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/b2b-partner/managed-operations"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2BManagedOperations />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/corporate-profile"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <CorporateProfilePage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/corporate/assigned-vehicles"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateAssignedVehiclesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corporate/bookings"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateEmployeeBookingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/corporate/employee-management"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateEmployeeManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />{" "}
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />{" "}
              </PublicRoute>
            }
          />
          <Route
            path="/set-password"
            element={
              <PublicRoute>
                <SetPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/admin-login"
            element={
              <PublicAdminRoute>
                <AdminLoginPage />{" "}
              </PublicAdminRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedAdminRoleBasedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboardPage />
              </ProtectedAdminRoleBasedRoute>
            }
          />
          <Route
            path="/admin-payment-verification"
            element={
              <ProtectedAdminRoleBasedRoute allowedRoles={["ADMIN"]}>
                <PaymentVerification />
              </ProtectedAdminRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner/vehicle-assignment"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerAssignmentUI />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner/vehicle-assignmentlist"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerVehicleAssignmentList />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/b2b-partner/vehicle-assignmentform"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerVehicleAssignmentForm />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/b2b-partner/assigned-vehicles/:contractId"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER"]}>
                <B2B_PartnerAssignedVehicles />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/driver/b2c-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2C_PARTNER_DRIVER"]}>
                <Navbar />
                <B2CPartnerDriverDashboard />
                {/* <Footer /> */}
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/driver/b2b-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER_DRIVER", "SCHOOL_PARTNER_DRIVER"]}>
                <B2BPartnerDriverDashboard />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/driver/corporate-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE_DRIVER"]}>
                <CorporateDriverDashboard />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/driver/location-tracking"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={[
                  "B2C_PARTNER_DRIVER",
                  "B2B_PARTNER_DRIVER",
                  "SCHOOL_PARTNER_DRIVER",
                  "CORPORATE_DRIVER",
                ]}
              >
                <DriverLocationTracking />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/payment-success" element={<PaymentCallback />} />
          <Route path="/payment-cancel" element={<PaymentCallback />} />

          {/* EMI Payment Callback Routes */}
          <Route
            path="/emi-payment/callback"
            element={<EMIPaymentCallback />}
          />

          {/* Dynamic Pages - Terms, Privacy, Refund, Contact etc */}
          <Route path="/page/:slug" element={<DynamicPage />} />
          <Route path="/terms-and-conditions" element={<DynamicPage />} />
          <Route path="/privacy-policy" element={<DynamicPage />} />
          <Route path="/refund-policy" element={<DynamicPage />} />
          <Route path="/contact-us" element={<DynamicPage />} />
        </Routes>
      </SocketProvider>
    </Provider>
  );
}

export default App;
