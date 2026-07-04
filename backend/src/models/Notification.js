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
        // Free-form notification type. We intentionally do NOT use a strict
        // mongoose enum here: the admin-monitoring layer dynamically creates
        // `ADMIN_MONITOR_${type}` variants for every notification type, which
        // made an exhaustive enum impossible to maintain and silently dropped
        // any unlisted type (a real bug). Type values are produced only by
        // trusted server-side code, so a required String is the correct level
        // of validation. See notificationService.js for the canonical set.
        type: {
            type: String,
            required: true,
            trim: true,
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
