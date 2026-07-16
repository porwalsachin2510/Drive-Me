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
import b2cPartnerReducer from "./slices/b2cPartnerSlice"
import commuterBookingReducer from "./slices/commuterBookingSlice"
import adminDashboardReducer from "./slices/adminDashboardSlice"
import commuterReducer from "./slices/commuterSlice"
import corporateOperationsReducer from "./slices/corporateOperationsSlice"
import corporateOperationsEnhancedReducer from "./slices/corporateOperationsSliceEnhanced"
import emiPaymentReducer from "./slices/emiPaymentSlice"
import localeReducer from "./slices/localeSlice"
import requestCartReducer from "./slices/requestCartSlice"

export const store = configureStore({
    reducer: {
        auth: authReducer,
        locale: localeReducer,
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
        b2cPartner: b2cPartnerReducer,
        commuterBooking: commuterBookingReducer,
        adminDashboard: adminDashboardReducer,
        commuter: commuterReducer,
        corporateOperations: corporateOperationsReducer,
        corporateOpsEnhanced: corporateOperationsEnhancedReducer,
        emiPayment: emiPaymentReducer,
        requestCart: requestCartReducer,
    },
})

export default store
