import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        type: {
            type: String,
            enum: [
                // Existing types
                "QUOTATION_REQUEST",
                "QUOTATION_RESPONSE",
                "QUOTATION_ACCEPTED",
                "QUOTATION_REJECTED",
                "QUOTATION_NEGOTIATION",
                "NEGOTIATION",
                "CONTRACT_PENDING",
                "CONTRACT_CREATED",
                "CONTRACT_DOCUMENT_UPLOADED",
                "CONTRACT_SIGNED",
                "CONTRACT_FULLY_SIGNED",
                "CONTRACT_REJECTED",
                "CONTRACT_COMPLETED",
                "VEHICLE_ASSIGNED",
                "VEHICLE_APPROVED",
                "VEHICLE_REJECTED",
                "PAYMENT_RECEIVED",
                "BOOKING_CONFIRMED",
                "MAINTENANCE_DUE",
                "DOCUMENT_EXPIRY",
                "SYSTEM_NOTIFICATION",
                "NEW_BOOKING",
                "BOOKING_ACCEPTED",
                "BOOKING_REJECTED",
                "BOOKING_CANCELLED",
                "RIDE_COMPLETED",
                "NEW_CORPORATE_BOOKING",
                "PAYMENT_PENDING",
                "PAYMENT_COMPLETED",
                "PAYMENT_FAILED",
                "REFUND_PROCESSED",
                "DRIVER_ASSIGNED",
                "DRIVER_ARRIVING",
                "RIDE_STARTED",
                "REVIEW_REQUEST",
                "TRIP_STARTED",
                "TRIP_COMPLETED",
                "TRIP_REMINDER",
                "TRIP_DELAY",
                "TRIP_START_REMINDER",
                "TRIP_UPDATE",
                "LATE_TRIP_START",
                "BOOKING_UPDATE",
                "SUBSCRIPTION_RENEWAL",
                "PAYMENT_REMINDER",
                "ROUTE_REQUEST",
                "CORPORATE_UPDATE",
                "EMERGENCY",
                "NEW_QUOTATION",
                "ADMIN_ALERT",
                "WALLET_UPDATED",
                "WALLET_LOW_BALANCE",
                "WALLET_FUND_REQUIRED",
                "WALLET_FUND_ADDED",
                "WALLET_WITHDRAWAL",
                "PAYMENT_SUBMITTED",
                "PAYMENT_VERIFIED",
                "PAYMENT_REJECTED",
                "CONTRACT_ACTIVATED",
                "CONTRACT_UPDATE",
                "ASSIGNMENT_UPDATED",
                "VEHICLE_CHANGED",
                "QUOTATION_RECEIVED",
                "WALLET_ADMIN_ALERT",
                "WALLET_ACTION_REQUIRED",
                "WALLET_USER_RESPONSE",
                "CONTRACT_EXPIRY_WARNING",
                "GENERAL",
                // Booking timeout/auto-cancellation notifications
                "BOOKING_WARNING",
                "BOOKING_AUTO_CANCELLED",
                "BOOKING_TIMEOUT_CANCELLED",
                // Admin monitoring types
                "ADMIN_MONITOR_CONTRACT_CREATED",
                "ADMIN_MONITOR_CONTRACT_DOCUMENT_UPLOADED",
                "ADMIN_MONITOR_CONTRACT_SIGNED",
                "ADMIN_MONITOR_CONTRACT_FULLY_SIGNED",
                "ADMIN_MONITOR_VEHICLE_ASSIGNED",
                "ADMIN_MONITOR_PAYMENT_RECEIVED",
                "ADMIN_MONITOR_QUOTATION_REQUEST",
                "ADMIN_MONITOR_QUOTATION_RESPONSE",
                // Admin monitoring for booking timeout/auto-cancellation
                "ADMIN_MONITOR_BOOKING_WARNING",
                "ADMIN_MONITOR_BOOKING_AUTO_CANCELLED",
                "ADMIN_MONITOR_BOOKING_TIMEOUT_CANCELLED",
                // Signed document notifications
                "SIGNED_DOCUMENT_UPLOADED",
                "SIGNED_DOCUMENT_VERIFIED",
                "SIGNED_DOCUMENT_REJECTED",
                "ADMIN_MONITOR_SIGNED_DOCUMENT_UPLOADED",
                "ADMIN_MONITOR_SIGNED_DOCUMENT_VERIFIED",
                "ADMIN_MONITOR_SIGNED_DOCUMENT_REJECTED",
                // Negotiation notifications
                "NEGOTIATION_REQUEST",
                "NEGOTIATION_UPDATE",
                "NEGOTIATION_OFFER",
                "NEGOTIATION_STARTED",
                "NEGOTIATION_MESSAGE",
                "NEGOTIATION_RESPONSE",
                "NEGOTIATION_ACCEPTED",
                "NEGOTIATION_REJECTED",
                "NEGOTIATION_COUNTER_OFFER",
                "NEGOTIATION_COMPLETED",
                "ADMIN_MONITOR_NEGOTIATION_REQUEST",
                "ADMIN_MONITOR_NEGOTIATION_UPDATE",
                "ADMIN_MONITOR_NEGOTIATION_OFFER",
                "ADMIN_MONITOR_NEGOTIATION_STARTED",
                "ADMIN_MONITOR_NEGOTIATION_MESSAGE",
                "ADMIN_MONITOR_NEGOTIATION_RESPONSE",
                "ADMIN_MONITOR_NEGOTIATION_ACCEPTED",
                "ADMIN_MONITOR_NEGOTIATION_REJECTED",
                "ADMIN_MONITOR_NEGOTIATION_COUNTER_OFFER",
                "ADMIN_MONITOR_NEGOTIATION_COMPLETED",
                // EMI Payment notifications
                "EMI_PLAN_CREATED",
                "EMI_PAYMENT_DUE",
                "EMI_PAYMENT_OVERDUE",
                "EMI_PAYMENT_COMPLETED",
                "EMI_PAYMENT_VERIFIED",
                "EMI_PAYMENT_REJECTED",
                "EMI_PAYMENT_CREDITED",
                "EMI_PAYMENT_SUBMITTED",
                "EMI_PAYMENT_PENDING_VERIFICATION",
                "EMI_WARNING",
                "EMI_SERVICE_SUSPENDED",
                "EMI_SERVICE_RESUMED",
                "ADMIN_MONITOR_EMI_PLAN_CREATED",
                "ADMIN_MONITOR_EMI_PAYMENT_RECEIVED",
                "ADMIN_MONITOR_EMI_PAYMENT_OVERDUE",
                "ADMIN_MONITOR_EMI_PAYMENT_COMPLETED",
                "ADMIN_MONITOR_EMI_PAYMENT_CREDITED",
                "ADMIN_MONITOR_EMI_PAYMENT_PENDING_VERIFICATION",
                // Account status notifications
                "ACCOUNT_SUSPENDED",
                "ACCOUNT_ACTIVATED",
                "ADMIN_MONITOR_ACCOUNT_SUSPENDED",
                "ADMIN_MONITOR_ACCOUNT_ACTIVATED",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        relatedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: {
                type: String,
                enum: ["B2CPassengerBooking", "CorporateBooking"]
            },
            required: false,
        },
        relatedEntityId: mongoose.Schema.Types.ObjectId,
        relatedEntityType: {
            type: String,
            enum: ["QUOTATION", "CONTRACT", "BOOKING", "PAYMENT", "VEHICLE", "B2C_BOOKING", "CORPORATE_BOOKING", "RIDE", "WALLET"],
        },

        // Admin wallet notification specific fields
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: false,
        },
        adminNotificationReason: {
            type: String,
            required: false,
        },
        actionRequired: {
            type: String,
            enum: ["ADD_FUNDS", "MAKE_PAYMENT", "REVIEW_TRANSACTION", "NONE"],
            default: "NONE",
        },
        userResponseStatus: {
            type: String,
            enum: ["PENDING", "COMPLETED", "IGNORED"],
            default: "PENDING",
        },
        userResponseAt: {
            type: Date,
            default: null,
        },
        
        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: Date,
        status: {
            type: String,
            enum: ["UNREAD", "READ", "ARCHIVED"],
            default: "UNREAD",
        },
    },
    {
        timestamps: true,
    },
)

notificationSchema.pre("save", function (next) {
    if (this.recipientId && !this.userId) {
        this.userId = this.recipientId
    }
    if (this.userId && !this.recipientId) {
        this.recipientId = this.userId
    }
    next()
})

notificationSchema.index({ userId: 1, isRead: 1 })
notificationSchema.index({ recipientId: 1, status: 1 })
notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ type: 1 })

const Notification = mongoose.model("Notification", notificationSchema)

export default Notification
