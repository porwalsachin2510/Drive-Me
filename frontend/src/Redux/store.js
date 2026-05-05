import { configureStore } from "@reduxjs/toolkit"
import authReducer from "./slices/authSlice"
import vehicleReducer from "./slices/vehicleSlice"
import quotationReducer from "./slices/quotationSlice"
import contractReducer from "./slices/contractSlice"
import paymentReducer from "./slices/paymentSlice"
import walletReducer from "./slices/walletSlice"
import adminReducer from "./slices/adminSlice"
import vehicleAssignmentReducer from "./slices/vehicleAssignmentSlice"
import paymentScheduleReducer from "./slices/paymentScheduleSlice"
import driverReducer from "./slices/driverSlice"
import bookingReducer from "./slices/bookingSlice"
import notificationReducer from "./slices/notificationSlice"
import corporateEmployeeReducer from "./slices/corporateEmployeeSlice"
import b2bPartnerReducer from "./slices/b2bPartnerSlice"
import commuterBookingReducer from "./slices/commuterBookingSlice"
import adminDashboardReducer from "./slices/adminDashboardSlice"
import commuterReducer from "./slices/commuterSlice"
import corporateOperationsReducer from "./slices/corporateOperationsSlice"
import corporateOperationsEnhancedReducer from "./slices/corporateOperationsSliceEnhanced"
import emiPaymentReducer from "./slices/emiPaymentSlice"

export const store = configureStore({
    reducer: {
        auth: authReducer,
        vehicles: vehicleReducer,
        quotation: quotationReducer,
        contract: contractReducer,
        payment: paymentReducer,
        wallet: walletReducer,
        admin: adminReducer,
        vehicleAssignment: vehicleAssignmentReducer,
        paymentSchedule: paymentScheduleReducer,
        driver: driverReducer,
        booking: bookingReducer,
        notifications: notificationReducer,
        corporateEmployee: corporateEmployeeReducer,
        b2bPartner: b2bPartnerReducer,
        commuterBooking: commuterBookingReducer,
        adminDashboard: adminDashboardReducer,
        commuter: commuterReducer,
        corporateOperations: corporateOperationsReducer,
        corporateOpsEnhanced: corporateOperationsEnhancedReducer,
        emiPayment: emiPaymentReducer,
    },
})

export default store
