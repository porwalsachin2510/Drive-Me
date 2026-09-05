import TermsAndConditions from "../models/TermsAndConditions.js"
import User from "../models/User.js"

/**
 * Get latest active terms and conditions
 * GET /api/terms/latest
 */
export const getLatestTerms = async (req, res) => {
    try {
        const { role, userType } = req.query
        const queryRole = role || userType

        const terms = await TermsAndConditions.getLatest()

        if (!terms) {
            // Return default terms if none exist
            return res.json({
                success: true,
                data: getDefaultTerms(queryRole),
            })
        }

        // If role is specified, return role-specific terms
        if (queryRole) {
            const roleTerms = await TermsAndConditions.getForRole(queryRole)
            return res.json({
                success: true,
                data: roleTerms,
            })
        }

        res.json({
            success: true,
            data: terms,
        })
    } catch (error) {
        console.error("Error getting latest terms:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get terms and conditions",
            error: error.message,
        })
    }
}

/**
 * Get specific version of terms
 * GET /api/terms/:version
 */
export const getTermsByVersion = async (req, res) => {
    try {
        const { version } = req.params

        const terms = await TermsAndConditions.findOne({ version })

        if (!terms) {
            return res.status(404).json({
                success: false,
                message: "Terms version not found",
            })
        }

        res.json({
            success: true,
            data: terms,
        })
    } catch (error) {
        console.error("Error getting terms by version:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get terms and conditions",
            error: error.message,
        })
    }
}

/**
 * Create new terms and conditions (Admin)
 * POST /api/admin/terms
 */
export const createTerms = async (req, res) => {
    try {
        const {
            version,
            content,
            commissionRanges,
            adminServices,
            effectiveFrom,
        } = req.body

        // Check if version already exists
        const existingVersion = await TermsAndConditions.findOne({ version })
        if (existingVersion) {
            return res.status(400).json({
                success: false,
                message: "This version already exists",
            })
        }

        const terms = new TermsAndConditions({
            version,
            content: content || getDefaultContent(),
            commissionRanges: commissionRanges || getDefaultCommissionRanges(),
            adminServices: adminServices || getDefaultAdminServices(),
            effectiveFrom: effectiveFrom || new Date(),
            isActive: true,
            createdBy: req.userId,
        })

        await terms.save()

        res.status(201).json({
            success: true,
            message: "Terms and conditions created successfully",
            data: terms,
        })
    } catch (error) {
        console.error("Error creating terms:", error)
        res.status(500).json({
            success: false,
            message: "Failed to create terms and conditions",
            error: error.message,
        })
    }
}

/**
 * Update terms and conditions (Admin)
 * PUT /api/admin/terms/:version
 */
export const updateTerms = async (req, res) => {
    try {
        const { version } = req.params
        const updates = req.body

        const terms = await TermsAndConditions.findOneAndUpdate(
            { version },
            { ...updates },
            { new: true }
        )

        if (!terms) {
            return res.status(404).json({
                success: false,
                message: "Terms version not found",
            })
        }

        res.json({
            success: true,
            message: "Terms updated successfully",
            data: terms,
        })
    } catch (error) {
        console.error("Error updating terms:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update terms",
            error: error.message,
        })
    }
}

/**
 * Get all terms versions (Admin)
 * GET /api/admin/terms
 */
export const getAllTermsVersions = async (req, res) => {
    try {
        const terms = await TermsAndConditions.find()
            .populate("createdBy", "fullName email")
            .sort({ effectiveFrom: -1 })

        res.json({
            success: true,
            data: terms,
        })
    } catch (error) {
        console.error("Error getting all terms:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get terms",
            error: error.message,
        })
    }
}

/**
 * Activate a specific terms version (Admin)
 * PUT /api/admin/terms/:version/activate
 */
export const activateTermsVersion = async (req, res) => {
    try {
        const { version } = req.params

        // Deactivate all other versions
        await TermsAndConditions.updateMany({}, { isActive: false })

        // Activate specified version
        const terms = await TermsAndConditions.findOneAndUpdate(
            { version },
            { isActive: true },
            { new: true }
        )

        if (!terms) {
            return res.status(404).json({
                success: false,
                message: "Terms version not found",
            })
        }

        res.json({
            success: true,
            message: "Terms version activated successfully",
            data: terms,
        })
    } catch (error) {
        console.error("Error activating terms:", error)
        res.status(500).json({
            success: false,
            message: "Failed to activate terms",
            error: error.message,
        })
    }
}

/**
 * Get users who accepted specific terms version (Admin)
 * GET /api/admin/terms/:version/acceptances
 */
export const getTermsAcceptances = async (req, res) => {
    try {
        const { version } = req.params
        const { page = 1, limit = 50 } = req.query

        const users = await User.find({
            "termsAndConditions.version": version,
            "termsAndConditions.accepted": true,
        })
            .select("fullName email role termsAndConditions createdAt")
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await User.countDocuments({
            "termsAndConditions.version": version,
            "termsAndConditions.accepted": true,
        })

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("Error getting terms acceptances:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get acceptances",
            error: error.message,
        })
    }
}

// Helper functions for default content

function getDefaultTerms(role) {
    return {
        version: "1.0.0",
        generalTerms: getDefaultContent().general,
        commissionDisclosure: getDefaultContent().commissionDisclosure,
        roleSpecificTerms: getRoleSpecificTerms(role),
        commissionRange: getDefaultCommissionRanges()[getRoleKey(role)] || getDefaultCommissionRanges().b2cPartner,
        adminServices: getDefaultAdminServices()[getRoleKey(role)] || [],
        effectiveFrom: new Date(),
    }
}

function getRoleKey(role) {
    switch (role) {
        case "B2C_PARTNER":
            return "b2cPartner"
        case "B2B_PARTNER":
        case "SCHOOL_PARTNER":
            return "b2bPartner"
        case "CORPORATE":
        case "SCHOOL_CUSTOMER":
            return "corporate"
        case "COMMUTER":
            return "commuter"
        default:
            return "b2cPartner"
    }
}

function getRoleSpecificTerms(role) {
    const terms = getDefaultContent()
    switch (role) {
        case "B2C_PARTNER":
            return terms.b2cPartner
        case "B2B_PARTNER":
        case "SCHOOL_PARTNER":
            return terms.b2bPartner
        case "CORPORATE":
        case "SCHOOL_CUSTOMER":
            return terms.corporate
        case "COMMUTER":
            return terms.commuter
        default:
            return ""
    }
}

function getDefaultContent() {
    return {
        general: `
Welcome to DriveMe Platform. By registering and using our services, you agree to the following terms and conditions:

1. ACCEPTANCE OF TERMS
By creating an account and using our platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.

2. PLATFORM SERVICES
DriveMe provides a digital platform connecting transportation service providers with customers seeking transportation solutions. We act as an intermediary to facilitate these connections.

3. USER RESPONSIBILITIES
- You must provide accurate and complete information during registration
- You are responsible for maintaining the confidentiality of your account credentials
- You agree to use the platform only for lawful purposes
- You must comply with all applicable local laws and regulations

4. PAYMENTS AND COMMISSION
The platform charges a commission on transactions facilitated through our services. The commission rate ranges from 0% to 35% depending on your account type, service area, transaction volume, and partnership level. The specific commission rate applicable to your account will be communicated to you and may be adjusted by the platform administration.

5. SERVICE FEES
All fees and charges will be clearly communicated before any transaction is confirmed. You agree to pay all applicable fees associated with your use of the platform.

6. PRIVACY AND DATA PROTECTION
We collect and process your personal data in accordance with our Privacy Policy. By using our services, you consent to such processing.

7. DISPUTE RESOLUTION
Any disputes arising from the use of our platform will be resolved through our internal dispute resolution process first, before escalating to external arbitration if necessary.

8. LIMITATION OF LIABILITY
DriveMe is not liable for any indirect, incidental, or consequential damages arising from the use of our platform.

9. MODIFICATIONS
We reserve the right to modify these terms at any time. Continued use of the platform after modifications constitutes acceptance of the new terms.

10. TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.

For any questions about these terms, please contact our support team.
        `.trim(),

        commissionDisclosure: `
COMMISSION DISCLOSURE

As a user of DriveMe platform, you acknowledge and agree that:

1. COMMISSION STRUCTURE
The platform charges a commission on all transactions processed through our services. Commission rates range from 0% to 35% based on:
- Your user type and role
- Service area and market conditions
- Transaction volume and history
- Partnership level and agreements
- Special promotions or incentives

2. COMMISSION CALCULATION
Commission is calculated as a percentage of the total transaction amount and is automatically deducted before settlement.

3. ADMIN SERVICES
In exchange for the commission, DriveMe provides:
- Platform access and maintenance
- Customer support and dispute resolution
- Payment processing and security
- Marketing and visibility on the platform
- Quality assurance and verification services
- Negotiation services (for eligible users)

4. RATE CHANGES
Commission rates may be adjusted by the platform administration. You will be notified of any changes to your specific commission rate.

5. TRANSPARENCY
You can view your current commission rate and transaction history in your account dashboard at any time.

By proceeding with registration, you confirm your understanding and acceptance of these commission terms.
        `.trim(),

        b2cPartner: `
B2C PARTNER SPECIFIC TERMS

As a B2C Partner providing transportation services to commuters:

1. SERVICE STANDARDS
- You must maintain a valid license and insurance for your vehicle(s)
- Vehicle(s) must pass our inspection requirements
- You must maintain professional conduct with all passengers
- Service must be provided as per the scheduled times

2. COMMISSION ON BOOKINGS
Commission (0-35%) is charged on each booking you accept from commuters. This includes:
- One-way trips
- Round trips
- Monthly passes

3. EARNINGS AND PAYOUTS
- Earnings are calculated after commission deduction
- Payouts are processed according to our settlement schedule
- You can track all transactions in your dashboard

4. CANCELLATION POLICY
Frequent cancellations may result in account review and potential penalties.

5. PASSENGER SAFETY
You are responsible for passenger safety during trips and must follow all traffic laws.
        `.trim(),

        b2bPartner: `
B2B PARTNER SPECIFIC TERMS

As a B2B Partner providing fleet services to corporate clients:

1. FLEET REQUIREMENTS
- All vehicles must meet our quality and safety standards
- Proper documentation must be maintained for all vehicles and drivers
- Regular maintenance and inspections are required

2. COMMISSION ON CONTRACTS
Commission (0-35%) is charged on each contract you enter into with corporate clients through our platform. The commission is calculated on the total contract value.

3. CONTRACT MANAGEMENT
- Contracts are legally binding agreements
- You must fulfill all contract terms as agreed
- Disputes should be reported through the platform

4. DRIVER MANAGEMENT
- You are responsible for your drivers' conduct
- Drivers must have valid licenses and documentation
- Driver assignments must be made through the platform

5. ADMIN NEGOTIATION
Corporate clients may request admin assistance in price negotiation. If you agree to reduced prices through negotiation, the contract will proceed with the negotiated terms.
        `.trim(),

        corporate: `
CORPORATE USER SPECIFIC TERMS

As a Corporate user seeking fleet services:

1. SERVICE REQUESTS
- Submit accurate requirements for quotations
- Review quotations carefully before acceptance
- Ensure payment terms are understood

2. CONTRACTS
- Accepted quotations become binding contracts
- Contract modifications require mutual agreement
- Payment must be made according to agreed schedules

3. ADMIN NEGOTIATION SERVICE
You may request admin assistance to negotiate better prices with B2B Partners:
- Request negotiation on any quotation you receive
- Admin will negotiate on your behalf
- If successful, a commission (0-35% of savings) may apply
- The negotiated price becomes the new quotation price
- Standard quotation acceptance process then applies

4. VEHICLE ACCESS
Vehicles are accessible only during active contract periods with valid payments.

5. DISPUTE RESOLUTION
Report any service issues through the platform for resolution.
        `.trim(),

        commuter: `
COMMUTER SPECIFIC TERMS

As a Commuter using transportation services:

1. BOOKING SERVICES
- Book rides through the platform
- Ensure accurate pickup and drop-off information
- Be ready at the scheduled time

2. PAYMENTS
- Payment is required as per booking terms
- Multiple payment options are available
- Refund policies apply as per specific service terms

3. CANCELLATION
- Cancellation policies vary by service type
- Late cancellations may incur charges

4. SAFETY
- Follow driver instructions during trips
- Report any safety concerns immediately

5. FEEDBACK
Your feedback helps improve service quality for all users.
        `.trim(),
    }
}

function getDefaultCommissionRanges() {
    return {
        b2cPartner: {
            min: 0,
            max: 35,
            description:
                "Commission is charged on each booking accepted from commuters. The exact rate (0-35%) is set by Admin based on your service area, booking volume, and partnership level. This commission covers platform access, customer support, payment processing, and marketing services.",
        },
        b2bPartner: {
            min: 0,
            max: 35,
            description:
                "Commission is charged on each contract with Corporate clients. The exact rate (0-35%) is determined by Admin based on contract value, service complexity, and partnership agreement. This covers platform services, quality assurance, and business matching.",
        },
        corporate: {
            min: 0,
            max: 35,
            description:
                "If you use our Admin negotiation service to get better prices from B2B Partners, a commission (0-35% of savings achieved) may be charged. This is optional - you only pay commission when you use the negotiation service and we successfully reduce the price for you.",
        },
    }
}

function getDefaultAdminServices() {
    return {
        b2cPartner: [
            {
                service: "Platform Access",
                description: "Full access to our booking platform with route management, scheduling, and passenger matching features.",
            },
            {
                service: "Customer Support",
                description: "24/7 support for handling passenger inquiries, complaints, and dispute resolution.",
            },
            {
                service: "Payment Processing",
                description: "Secure payment collection from passengers with multiple payment options and timely settlements.",
            },
            {
                service: "Marketing & Visibility",
                description: "Promotion of your services to commuters searching for routes in your service area.",
            },
            {
                service: "Quality Assurance",
                description: "Vehicle verification, driver background checks, and service quality monitoring.",
            },
        ],
        b2bPartner: [
            {
                service: "Business Matching",
                description: "Connection with verified corporate clients looking for fleet services.",
            },
            {
                service: "Contract Management",
                description: "Digital contract creation, tracking, and management tools.",
            },
            {
                service: "Payment Security",
                description: "Secure payment processing and milestone-based payment scheduling.",
            },
            {
                service: "Fleet Management Tools",
                description: "Digital tools for vehicle and driver management, assignment tracking, and reporting.",
            },
            {
                service: "Dispute Resolution",
                description: "Professional mediation for any disputes with corporate clients.",
            },
        ],
        corporate: [
            {
                service: "Vendor Discovery",
                description: "Access to verified B2B Partners with transparent ratings and reviews.",
            },
            {
                service: "Quotation Management",
                description: "Easy quotation request, comparison, and management tools.",
            },
            {
                service: "Admin Negotiation",
                description: "Optional service where Admin negotiates better prices with B2B Partners on your behalf.",
            },
            {
                service: "Contract Tracking",
                description: "Real-time tracking of contract status, vehicle assignments, and service delivery.",
            },
            {
                service: "Dedicated Support",
                description: "Priority support for contract-related queries and issue resolution.",
            },
        ],
    }
}
