import mongoose from "mongoose"

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        otp: {
            type: String,
            required: true,
        },
        purpose: {
            type: String,
            enum: ["registration", "password_reset", "email_verification"],
            default: "registration",
        },
        isUsed: {
            type: Boolean,
            default: false,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3,
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            expires: 0,
        },
        registrationData: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    { timestamps: true }
)

// Index for cleanup and lookup
otpSchema.index({ email: 1, purpose: 1 })
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Method to check if OTP is valid
otpSchema.methods.isValid = function() {
    return !this.isUsed && 
           this.attempts < this.maxAttempts && 
           this.expiresAt > new Date()
}

// Method to verify OTP
otpSchema.methods.verify = function(inputOtp) {
    if (!this.isValid()) {
        return false
    }
    
    this.attempts += 1
    if (this.otp === inputOtp) {
        this.isUsed = true
        return true
    }
    return false
}

const OTP = mongoose.model("OTP", otpSchema)
export default OTP
