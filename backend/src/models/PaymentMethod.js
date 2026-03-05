import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["CREDIT_CARD", "DEBIT_CARD", "BANK_ACCOUNT", "WALLET"],
            required: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Credit/Debit Card details
        cardDetails: {
            lastFour: String,
            brand: String, // Visa, Mastercard, etc.
            expiryMonth: Number,
            expiryYear: Number,
            cardholderName: String,
            token: String, // Payment gateway token
        },
        // Bank account details
        bankDetails: {
            accountNumber: String, // Encrypted
            accountHolderName: String,
            bankName: String,
            iban: String, // Encrypted
            swiftCode: String,
        },
        // Wallet details
        walletDetails: {
            provider: String, // Apple Pay, Google Pay, etc.
            walletId: String,
            deviceToken: String,
        },
        // Verification status
        verificationStatus: {
            type: String,
            enum: ["PENDING", "VERIFIED", "FAILED"],
            default: "PENDING",
        },
        // Usage statistics
        usageStats: {
            totalTransactions: {
                type: Number,
                default: 0,
            },
            totalAmount: {
                type: Number,
                default: 0,
            },
            lastUsed: Date,
        },
        // Billing address
        billingAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
            postalCode: String,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { 
        timestamps: true,
        toJSON: { 
            virtuals: true,
            transform: function(doc, ret) {
                delete ret.cardDetails?.token;
                delete ret.bankDetails?.accountNumber;
                delete ret.bankDetails?.iban;
                return ret;
            }
        },
        toObject: { 
            virtuals: true,
            transform: function(doc, ret) {
                delete ret.cardDetails?.token;
                delete ret.bankDetails?.accountNumber;
                delete ret.bankDetails?.iban;
                return ret;
            }
        }
    }
);

// Indexes
paymentMethodSchema.index({ userId: 1, isActive: 1 });
paymentMethodSchema.index({ userId: 1, isDefault: 1 });

// Pre-save middleware to ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
    if (this.isDefault && this.isNew) {
        // Set all other payment methods for this user to non-default
        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { isDefault: false }
        );
    }
    next();
});

const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);

export default PaymentMethod;
