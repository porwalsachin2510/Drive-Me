import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import { generateSequentialCode } from "../utils/generateSequentialCode.js"

/**
 * DemandEmployee
 * ---------------
 * Internal acquisition workforce for the Demand Generation module
 * (sales reps, partnership managers, field agents, etc.). These are
 * admin-managed records used to assign leads, track productivity, and
 * compute salary + commission + expense costs. They are intentionally
 * separate from the auth `User` collection (which holds customers,
 * partners, drivers and corporate commuters).
 */

const allowanceSchema = new mongoose.Schema(
    {
        type: { type: String, trim: true, default: "General" },
        amount: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
)

const salaryHistorySchema = new mongoose.Schema(
    {
        monthlySalary: { type: Number, required: true, min: 0 },
        allowances: { type: [allowanceSchema], default: [] },
        effectiveDate: { type: Date, required: true, default: Date.now },
        note: { type: String, trim: true, default: "" },
        changedAt: { type: Date, default: Date.now },
    },
    { _id: true }
)

const demandEmployeeSchema = new mongoose.Schema(
    {
        employeeCode: {
            type: String,
            unique: true,
            index: true,
        },
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        phone: { type: String, trim: true, default: "" },

        employeeType: {
            type: String,
            enum: ["PERMANENT", "TEMPORARY"],
            default: "PERMANENT",
        },
        department: { type: String, trim: true, default: "Sales" },
        designation: { type: String, trim: true, default: "" },

        reportingManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            default: null,
        },
        territory: { type: String, trim: true, default: "" },
        region: { type: String, trim: true, default: "" },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
            index: true,
        },
        joiningDate: { type: Date, default: Date.now },

        // Current salary snapshot
        monthlySalary: { type: Number, default: 0, min: 0 },
        salaryEffectiveDate: { type: Date, default: Date.now },
        allowances: { type: [allowanceSchema], default: [] },
        salaryHistory: { type: [salaryHistorySchema], default: [] },

        // Monthly onboarding / conversion target (used for targets vs achievement)
        monthlyTarget: { type: Number, default: 0, min: 0 },

        // ===== Staff Portal login =====
        // A DemandEmployee can optionally be given a login to the Staff Portal.
        // FIELD  => field/sales rep (e.g. Rahul) who works his own assigned leads.
        // FINANCE => finance officer who pays commissions & approved expenses.
        portalRole: {
            type: String,
            enum: ["FIELD", "FINANCE"],
            default: "FIELD",
            index: true,
        },
        hasPortalAccess: { type: Boolean, default: false },
        password: { type: String, default: null, select: false },
        lastLogin: { type: Date, default: null },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
)

// Auto-generate a human friendly employee code before validation
demandEmployeeSchema.pre("validate", async function (next) {
    if (!this.employeeCode) {
        this.employeeCode = await generateSequentialCode(
            mongoose.model("DemandEmployee"),
            "employeeCode",
            "DG-EMP-",
            4
        )
    }
    next()
})

// Concurrency safety net for the unique employeeCode index.
demandEmployeeSchema.post("save", async function (err, doc, next) {
    if (err && err.name === "MongoServerError" && err.code === 11000 && err.keyPattern?.employeeCode) {
        doc.employeeCode = await generateSequentialCode(
            mongoose.model("DemandEmployee"),
            "employeeCode",
            "DG-EMP-",
            4
        )
        return doc.save().then(() => next()).catch(next)
    }
    next(err)
})

// Hash the portal password whenever it is set/changed.
demandEmployeeSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password) return next()
    try {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
        next()
    } catch (error) {
        next(error)
    }
})

demandEmployeeSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password) return false
    return await bcrypt.compare(enteredPassword, this.password)
}

demandEmployeeSchema.virtual("totalAllowances").get(function () {
    return (this.allowances || []).reduce((sum, a) => sum + (a.amount || 0), 0)
})

// Never leak the password hash in API responses.
const stripPassword = (doc, ret) => {
    delete ret.password
    return ret
}

demandEmployeeSchema.set("toJSON", { virtuals: true, transform: stripPassword })
demandEmployeeSchema.set("toObject", { virtuals: true, transform: stripPassword })

export default mongoose.model("DemandEmployee", demandEmployeeSchema)
