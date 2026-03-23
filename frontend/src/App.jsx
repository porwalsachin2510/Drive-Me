import React from "react";
import { Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./Redux/store";
import { SocketProvider } from "./context/SocketContext";
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
import MyQuotations from "./Pages/CorporatePages/MyQuotations/MyQuotations";
import QuotationDetails from "./Pages/CorporatePages/QuotationDetails/QuotationDetails";
import CorporateContractDetails from "./Pages/CorporatePages/CorporateContractDetails/CorporateContractDetails";
import B2B_PartnerContractDetails from "./Pages/B2B_PartnerPages/B2B_PartnerContractDetails/B2B_PartnerContractDetails";
import PaymentCallback from "./Pages/PaymentCallback/PaymentCallback";
import B2B_PartnerAssignmentUI from "./Pages/B2B_PartnerPages/B2B_PartnerAssignmentUI/B2B_PartnerAssignmentUI";
import B2B_PartnerVehicleAssignmentList from "./Pages/B2B_PartnerPages/B2B_PartnerVehicleAssignment/B2B_PartnerVehicleAssignmentList";
import B2B_PartnerVehicleAssignmentForm from "./Pages/B2B_PartnerPages/B2B_PartnerVehicleAssignmentForm/B2B_PartnerVehicleAssignmentForm";
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
import CorporateDriverDashboard from "./Pages/DriverPages/CorporateDriverDashboard/CorporateDriverDashboard";
import DriverLocationTracking from "./Pages/DriverPages/DriverLocationTracking/DriverLocationTracking";
import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";
import SetPassword from "./Pages/SetPassword/SetPassword";
import DynamicPage from "./Pages/DynamicPage/DynamicPage";

function App() {
  return (
    <Provider store={store}>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/add-funds"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/withdraw"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/transactions"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"]}
              >
                <WalletPage />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/wallet/payment/verify"
            element={
              <ProtectedRoleBasedRoute
                allowedRoles={["COMMUTER", "B2C_PARTNER", "B2B_PARTNER"]}
              >
                <WalletPaymentCallback />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE_EMPLOYEE"]}>
                <EmployeeDashboard />
              </ProtectedRoleBasedRoute>
            }
          />

          <Route
            path="/employee/dashboard-old"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE_EMPLOYEE"]}>
                <CorporateEmployeeDashboard />
              </ProtectedRoleBasedRoute>
            }
          />

          {/* <Route
          path="/service-selection"
          element={
            <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
              <ServiceSelection />
            </ProtectedRoleBasedRoute>
          }
        /> */}
          <Route
            path="/corporate"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <Corporate />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/search-results"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <SearchResults />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/view-single-vehicle-owner"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["CORPORATE"]}>
                <SingleVehicleOwnerDetails />
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
            path="/corporate-profile"
            element={
              <ProtectedRoute allowedRoles={["CORPORATE"]}>
                <CorporateProfilePage />
              </ProtectedRoute>
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
            path="/driver/b2c-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2C_PARTNER_DRIVER"]}>
                <Navbar />
                <B2CPartnerDriverDashboard />
                <Footer />
              </ProtectedRoleBasedRoute>
            }
          />
          <Route
            path="/driver/b2b-dashboard"
            element={
              <ProtectedRoleBasedRoute allowedRoles={["B2B_PARTNER_DRIVER"]}>
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
