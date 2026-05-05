import mongoose from "mongoose"

const termsAndConditionsSchema = new mongoose.Schema(
    {
        version: {
            type: String,
            required: true,
            unique: true,
        },
        // General terms content
        content: {
            general: {
                type: String,
                required: true,
            },
            commissionDisclosure: {
                type: String,
                required: true,
            },
            // Role-specific terms
            b2cPartner: {
                type: String,
                default: "",
            },
            b2bPartner: {
                type: String,
                default: "",
            },
            corporate: {
                type: String,
                default: "",
            },
            commuter: {
                type: String,
                default: "",
            },
        },
        // Commission disclosure information
        commissionRanges: {
            b2cPartner: {
                min: {
                    type: Number,
                    default: 0,
                },
                max: {
                    type: Number,
                    default: 35,
                },
                description: {
                    type: String,
                    default:
                        "Commission is charged on each booking accepted from commuters. The exact rate (0-35%) is set by the Admin based on service area, volume, and partnership level.",
                },
            },
            b2bPartner: {
                min: {
                    type: Number,
                    default: 0,
                },
                max: {
                    type: Number,
                    default: 35,
                },
                description: {
                    type: String,
                    default:
                        "Commission is charged on each contract with Corporate clients. The exact rate (0-35%) is set by the Admin based on contract value and partnership level.",
                },
            },
            corporate: {
                min: {
                    type: Number,
                    default: 0,
                },
                max: {
                    type: Number,
                    default: 35,
                },
                description: {
                    type: String,
                    default:
                        "If you use Admin negotiation services to get better prices from B2B Partners, a commission (0-35% of savings) may be charged based on the negotiated discount.",
                },
            },
        },
        // Services provided by Admin
        adminServices: {
            b2cPartner: [
                {
                    service: String,
                    description: String,
                },
            ],
            b2bPartner: [
                {
                    service: String,
                    description: String,
                },
            ],
            corporate: [
                {
                    service: String,
                    description: String,
                },
            ],
        },
        effectiveFrom: {
            type: Date,
            required: true,
        },
        effectiveUntil: Date,
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
)

// Ensure only one active version
termsAndConditionsSchema.pre("save", async function (next) {
    if (this.isActive) {
        await mongoose.model("TermsAndConditions").updateMany(
            { _id: { $ne: this._id } },
            { isActive: false }
        )
    }
    next()
})

// Static method to get latest active terms
termsAndConditionsSchema.statics.getLatest = async function () {
    return this.findOne({ isActive: true }).sort({ effectiveFrom: -1 })
}

// Static method to get terms for specific role
termsAndConditionsSchema.statics.getForRole = async function (role) {
    const terms = await this.getLatest()
    if (!terms) return null

    // Map role to the correct database key
    const roleKeyMap = {
        B2C_PARTNER: "b2cPartner",
        B2B_PARTNER: "b2bPartner",
        CORPORATE: "corporate",
        COMMUTER: "commuter"
    }

    const roleKey = roleKeyMap[role] || "b2cPartner"

    const roleTerms = terms.content[roleKey] || ""
    
    return {
        version: terms.version,
        generalTerms: terms.content.general,
        commissionDisclosure: terms.content.commissionDisclosure,
        roleSpecificTerms: roleTerms,
        commissionRange: terms.commissionRanges[roleKey] || terms.commissionRanges.b2cPartner,
        adminServices: terms.adminServices[roleKey] || [],
        effectiveFrom: terms.effectiveFrom,
    }
}

const TermsAndConditions = mongoose.model("TermsAndConditions", termsAndConditionsSchema)

export default TermsAndConditions
