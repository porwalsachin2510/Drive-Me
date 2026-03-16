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
                "SUBSCRIPTION_RENEWAL",
                "PAYMENT_REMINDER",
                "ROUTE_REQUEST",
                "CORPORATE_UPDATE",
                "EMERGENCY",
                "NEW_QUOTATION",
                "ADMIN_ALERT",
                "WALLET_UPDATED",
                "CONTRACT_EXPIRY_WARNING",
                "GENERAL",
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
            enum: ["QUOTATION", "CONTRACT", "BOOKING", "PAYMENT", "VEHICLE", "B2C_BOOKING", "CORPORATE_BOOKING", "RIDE"],
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
