import User from "../models/User.js"
import OTP from "../models/OTP.js"
import { checkIdentityRegistrationEligibility, registerIdentityLedger } from "../Services/cashCancellationService.js"
import TermsAndConditions from "../models/TermsAndConditions.js"
import CommissionSettings from "../models/CommissionSettings.js"
import jwt from "jsonwebtoken"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { generateOTP, sendVerificationOTP, sendWelcomeEmailWithTerms } from "../Services/emailService.js"
import { sendAdminNotification } from "../Services/notificationService.js"
import { withOwnerPermissions } from "../Services/ownerService.js"
import {
    resolveRegistrationCountry,
    buildLocalePayload,
    getCountryCurrency,
    getCountryFromPhoneCode,
    isIdentityLockedUser,
    normalizeCountry,
} from "../Config/localizationConfig.js"
import { CUSTOMER_ROLES, PASSENGER_ROLES, passengerRoleForOwner } from "../utils/roleFamilies.js"

/**
 * Reconcile a user's stored `country` (and `nationality`) with the immutable
 * registration signal we always keep: their international dialing code
 * (e.g. "+965" => KW, "+971" => UAE). This is the SAME signal registration uses
 * to stamp the country in production, so re-asserting it here is a no-op for
 * healthy records and a self-heal for corrupted ones.
 *
 * Why this exists: older builds defaulted every account to "UAE" and a previous
 * version of the localization endpoint re-persisted a transient DEV_COUNTRY / IP
 * / stale-browser locale onto the profile. That left some accounts (e.g. a real
 * Kuwait partner) with country "UAE", so they saw AED everywhere. Healing on
 * login fixes those accounts the next time they sign in — no manual migration
 * needed — and keeps a partner's currency tied to where they actually operate.
 *
 * Guard rails:
 *   - ONLY identity-locked EARNERS are reconciled (partners, drivers, corporate
 *     & employees). Their country is a fixed business identity, so re-asserting
 *     the dialing code is always correct.
 *   - COMMUTERS are intentionally SKIPPED: their country is a switchable travel
 *     context (they may deliberately be browsing UAE on a "+965" SIM), so we
 *     must never overwrite their chosen country back to their dialing code.
 *   - Platform admins are location-independent and are never reconciled.
 *   - We only correct when the dialing code maps to a served country AND it
 *     differs from what's stored. Unknown codes are left untouched (no guessing).
 *   - This runs REGARDLESS of DEV_COUNTRY. The dialing code is the immutable
 *     identity for an earner, so DEV_COUNTRY (a developer's display toggle for
 *     anonymous/preview flows) must never leave a real Kuwait "+965" partner
 *     stranded on a stale "UAE" country. New accounts are stamped from the same
 *     dialing code, so this is a no-op for healthy records.
 *
 * Returns true when a correction was applied (caller persists the user).
 */
const reconcileUserCountryFromDialingCode = (user) => {
    if (!user || !isIdentityLockedUser(user)) return false

    const trueCountry = getCountryFromPhoneCode(user.countryCode)
    if (!trueCountry) return false

    const storedCountry = user.country ? normalizeCountry(user.country) : null
    if (storedCountry === trueCountry) return false

    const locale = buildLocalePayload(trueCountry)
    console.log("[v0] Reconciling account country from dialing code:", {
        userId: String(user._id),
        countryCode: user.countryCode,
        from: user.country,
        to: locale.country,
    })
    user.country = locale.country
    user.nationality = locale.countryName
    return true
}

const generateToken = (userId, role) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE })
}

export const register = async (req, res) => {
    try {
        const {
            role,
            fullName,
            email,
            whatsappNumber,
            countryCode,
            password,
            companyName,
            companyAddress,
            routeListings,
            fleetManagement,
            acceptedPaymentMethods,
            serviceType,
            yearsOfExperience,
            serviceDescription,
            // Terms and Conditions acceptance
            termsAccepted,
            termsVersion,
        } = req.body

        console.log("[v1] Register request:", { role, fullName, email })

        // Validation
        if (!role || !fullName || !email || !whatsappNumber || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            })
        }

        const validRoles = [
            "COMMUTER",
            "CORPORATE",
            "B2C_PARTNER",
            "B2B_PARTNER",
            "CORPORATE_EMPLOYEE",
            "SCHOOL_STUDENT",
            "SCHOOL_CUSTOMER",
            "SCHOOL_PARTNER",
        ]
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role",
            })
        }

        // A managed passenger self-registers by naming the organisation that buys
        // their monthly pass. That organisation is a CORPORATE (passenger is an
        // employee) or a SCHOOL_CUSTOMER (passenger is a student / school staff
        // member), so the wording here stays segment-neutral. The real segment is
        // resolved further down from the organisation that actually matches.
        if (PASSENGER_ROLES.includes(role) && (!companyName || companyName.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: "Organisation name is required for this registration.",
            })
        }

        // Validate T&C acceptance for roles that require it
        const rolesRequiringTerms = ["CORPORATE", "B2B_PARTNER", "B2C_PARTNER", "SCHOOL_CUSTOMER", "SCHOOL_PARTNER"]
        if (rolesRequiringTerms.includes(role) && !termsAccepted) {
            return res.status(400).json({
                success: false,
                message: "You must accept the Terms and Conditions to register.",
            })
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered",
            })
        }

        // ===== Anti-abuse identity check (COMMUTER only) =====
        // We do NOT collect any government ID (illegal in UAE/Kuwait). Instead we
        // build a stable identity from the registration details the user already
        // gives us — primarily their OTP-verified phone number, with their email
        // as a secondary matcher — and refuse registration if that identity already
        // has an unpaid cancellation due. This stops a commuter from deleting their
        // account and re-registering to dodge a cancellation charge.
        if (role === "COMMUTER") {
            const eligibility = await checkIdentityRegistrationEligibility({
                countryCode: countryCode || "+965",
                phone: whatsappNumber,
                email,
            })
            if (eligibility.blocked) {
                return res.status(403).json({
                    success: false,
                    code: "IDENTITY_BLOCKED",
                    outstandingDue: eligibility.outstanding,
                    existingEmail: eligibility.existingEmail,
                    message: eligibility.reason
                        || "Your details are already registered with an outstanding cancellation due. Please log in to your existing account and clear it before registering again.",
                })
            }
        }

        // Generate OTP
        const otp = generateOTP()

        // Save OTP to database
        await OTP.deleteMany({ email, purpose: "registration" }) // Clean up any existing OTPs
        const otpRecord = new OTP({
            email,
            otp,
            purpose: "registration"
        })
        await otpRecord.save()

        // Send OTP email
        const emailResult = await sendVerificationOTP(email, fullName, otp)
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            })
        }

        // Handle profile image upload for COMMUTER, B2C_PARTNER, and B2B_PARTNER
        let profileImageUrl = null;
        if (req.files && req.files.profileImage && req.files.profileImage[0]) {
            try {
                const uploadResult = await uploadToCloudinary(req.files.profileImage[0], 'driveme/profiles', 'profile');
                profileImageUrl = uploadResult.secure_url;
                console.log("[v1] Profile image uploaded:", profileImageUrl);
            } catch (uploadError) {
                console.error("[v1] Error uploading profile image:", uploadError);
            }
        }

        // Get commission range for T&C disclosure
        let commissionRange = { min: 0, max: 35 }
        try {
            const terms = await TermsAndConditions.getLatest()
            if (terms && terms.commissionRanges) {
                const roleKey =
                    role === "B2C_PARTNER"
                        ? "b2cPartner"
                        : role === "B2B_PARTNER" || role === "SCHOOL_PARTNER"
                            ? "b2bPartner"
                            : "corporate"
                commissionRange = terms.commissionRanges[roleKey] || commissionRange
            }
        } catch (e) {
            console.log("Could not fetch terms for commission range:", e.message)
        }

        // Store registration data temporarily (you could use Redis or session)
        // For now, we'll store it in the OTP document as metadata
        const registrationData = {
            role,
            fullName,
            email,
            whatsappNumber,
            countryCode: countryCode || "+965", // Default to platform base (Kuwait) if not provided
            password, // Plain password - User model pre-save hook will hash it
            companyName,
            companyAddress,
            routeListings,
            fleetManagement,
            acceptedPaymentMethods,
            serviceType,
            yearsOfExperience,
            serviceDescription,
            profileImage: profileImageUrl,
            // T&C acceptance data
            termsAccepted: termsAccepted || false,
            termsVersion: termsVersion || "1.0.0",
            termsAcceptedIp: req.ip || req.headers["x-forwarded-for"] || "unknown",
            disclosedCommissionRange: commissionRange,
        }

        // Store registration data in OTP document (in production, use Redis).
        // registrationData is a Mongoose `Mixed` type and this document was
        // already saved above, so Mongoose will NOT auto-detect this change.
        // We must markModified() or the field is silently dropped on save,
        // which later makes verifyOTP fail with a 400 "session expired".
        otpRecord.registrationData = registrationData
        otpRecord.markModified("registrationData")
        await otpRecord.save()

        console.log("[v1] OTP sent for email verification:", { email, role })

        res.status(200).json({
            success: true,
            message: "Registration initiated! Please check your email for verification code.",
            requiresVerification: true,
            email: email,
        })
    } catch (error) {
        console.error("[v1] Register error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Registration failed",
        })
    }
}

export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        // Verify user is an ADMIN
        if (user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin credentials required.",
            })
        }

        const isPasswordValid = await user.comparePassword(password)

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        // Update lastLogin timestamp
        user.lastLogin = new Date()
        await user.save()

        const token = generateToken(user._id, user.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            user: user.toJSON(),
        })
    } catch (error) {
        console.error("Admin login error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password credentials",
            })
        }

        // Check if user is suspended
        if (user.status === "SUSPENDED") {
            const suspensionEndDate = user.suspensionEndDate ? new Date(user.suspensionEndDate) : null
            const now = new Date()

            // Check if suspension has expired
            if (suspensionEndDate && suspensionEndDate < now) {
                // Auto-reactivate the user
                user.status = "ACTIVE"
                user.activatedAt = now
                user.suspensionEndDate = null
                user.suspensionReason = null
                user.suspensionDuration = null
                await user.save()
            } else {
                // Still suspended - calculate remaining days
                let remainingDays = 0
                if (suspensionEndDate) {
                    remainingDays = Math.ceil((suspensionEndDate - now) / (1000 * 60 * 60 * 24))
                }

                // Get admin email for contact
                const adminUser = await User.findOne({ role: "ADMIN" }).select("email").lean()
                const adminEmail = adminUser?.email || "admin@driveme.com"

                return res.status(403).json({
                    success: false,
                    isSuspended: true,
                    message: "Your account has been suspended",
                    suspensionDetails: {
                        reason: user.suspensionReason || "Violation of platform terms and conditions",
                        suspendedAt: user.suspendedAt,
                        suspensionEndDate: user.suspensionEndDate,
                        remainingDays: remainingDays > 0 ? remainingDays : null,
                        durationDays: user.suspensionDuration || 7,
                        adminEmail: adminEmail,
                        userName: user.fullName,
                        userEmail: user.email
                    }
                })
            }
        }

        // Self-heal a corrupted/legacy account country from the immutable
        // dialing code (e.g. a Kuwait "+965" partner stored as "UAE"). This runs
        // before we return the user so the corrected country is reflected
        // everywhere (header currency, wallet, earnings, settlements) on this
        // very session. No-op for healthy records and for DEV_COUNTRY testing.
        reconcileUserCountryFromDialingCode(user)

        // Update lastLogin timestamp
        user.lastLogin = new Date()
        await user.save()

        const token = generateToken(user._id, user.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            // The real platform owner always logs in with full super-admin access.
            user: withOwnerPermissions(user.toJSON()),
        })
    } catch (error) {
        console.error("Login error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            })
        }

        // Find valid OTP record
        const otpRecord = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: "registration",
            isUsed: false,
            expiresAt: { $gt: new Date() }
        })

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code",
            })
        }

        // Verify OTP
        const isValid = otpRecord.verify(otp)
        if (!isValid) {
            await otpRecord.save() // Save the incremented attempt count

            if (otpRecord.attempts >= otpRecord.maxAttempts) {
                return res.status(400).json({
                    success: false,
                    message: "Maximum attempts reached. Please request a new verification code.",
                })
            }

            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempts remaining.`,
            })
        }

        // Mark OTP as used
        await otpRecord.save()

        // Get registration data
        const registrationData = otpRecord.registrationData
        if (!registrationData) {
            return res.status(400).json({
                success: false,
                message: "Registration session expired. Please register again.",
            })
        }

        // Create user with verified email
        const userData = {
            ...registrationData,
            isEmailVerified: true,
        }

        // ===== Stamp the account's country & nationality at creation time =====
        // The registration form never sent a top-level `country`/`nationality`,
        // so previously every new account silently fell back to the User model
        // default ("UAE") — which is wrong for a user signing up from Kuwait
        // (or any other served country). Resolve the real country once here,
        // from DEV_COUNTRY (local/dev) -> the dialing code the user picked
        // (e.g. "+965" => KW) -> default, and persist BOTH the canonical code
        // and the human-readable nationality so currency, payment gateway,
        // routes and wallet are all consistent from day one.
        const registrationCountry = resolveRegistrationCountry({
            countryCode: userData.countryCode,
        })
        const registrationLocale = buildLocalePayload(registrationCountry)
        userData.country = registrationLocale.country
        userData.nationality = registrationLocale.countryName
        console.log("[v0] Resolved registration country:", {
            countryCode: userData.countryCode,
            country: userData.country,
            nationality: userData.nationality,
        })

        // Handle role-specific data processing
        if (userData.role === "COMMUTER") {
            const matchingCorporateUser = await User.findOne({
                role: "CORPORATE",
                companyName: { $regex: new RegExp(`^${userData.fullName.trim()}$`, "i") },
            })
                .select("companyName")
                .lean()
                .exec()

            if (matchingCorporateUser) {
                userData.companyName = matchingCorporateUser.companyName
                userData.companyId = matchingCorporateUser._id
            } else {
                userData.companyName = null
            }

            // ===== Re-verify identity eligibility at creation time =====
            // Re-check here too in case a cancellation due was recorded against
            // this identity between register and verify. The identity is built
            // from the registration phone/email — no government ID is collected.
            const eligibility = await checkIdentityRegistrationEligibility({
                countryCode: registrationData.countryCode || "+965",
                phone: registrationData.whatsappNumber,
                email: registrationData.email,
            })
            if (eligibility.blocked) {
                return res.status(403).json({
                    success: false,
                    code: "IDENTITY_BLOCKED",
                    outstandingDue: eligibility.outstanding,
                    existingEmail: eligibility.existingEmail,
                    message: eligibility.reason
                        || "Your details are already registered with an outstanding cancellation due. Please log in to your existing account and clear it before registering again.",
                })
            }

            // Seed the cash-cancellation mirror with this commuter's identity key
            // so future cancellations are anchored to a stable, durable identity.
            userData.cashCancellation = {
                outstandingDue: 0,
                strikeCount: 0,
                isBlocked: false,
                blockedReason: null,
                identityKey: eligibility.identityKey,
                currency: getCountryCurrency(registrationCountry),
                lastUpdatedAt: new Date(),
            }

            // No admin approval / KYC review is required anymore — government IDs
            // cannot be collected in UAE/Kuwait. The commuter is active as soon as
            // their phone OTP is verified.
            userData.status = "ACTIVE"
        }

        // Managed-service passenger self-registration. The applicant may pick
        // either passenger role from the public form (or an older client may only
        // know CORPORATE_EMPLOYEE); the authoritative segment always comes from
        // the organisation they name, so both entry points run the same lookup.
        if (PASSENGER_ROLES.includes(userData.role)) {
            // Check if companyName exists and is not empty
            if (!userData.companyName || userData.companyName.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Organisation name is required for this registration.",
                })
            }

            // A managed passenger self-registers by naming the organisation that
            // buys their monthly pass. That organisation can be a CORPORATE (the
            // passenger is an employee) or a SCHOOL_CUSTOMER (the passenger is a
            // student / school staff member). Look the organisation up across
            // BOTH customer segments and then store the passenger under the role
            // that matches its segment, so a school's people are never persisted
            // as CORPORATE_EMPLOYEE.
            const matchingCorporateUser = await User.findOne({
                role: { $in: CUSTOMER_ROLES },
                companyName: { $regex: new RegExp(`^${userData.companyName.trim()}$`, "i") },
            })
                .select("companyName role")
                .lean()
                .exec()

            if (!matchingCorporateUser) {
                return res.status(400).json({
                    success: false,
                    message: "Organisation not found. Please contact your organisation's admin.",
                })
            }

            userData.companyName = matchingCorporateUser.companyName
            userData.companyId = matchingCorporateUser._id
            userData.role = passengerRoleForOwner(matchingCorporateUser.role)
        }

        if (userData.role === "B2C_PARTNER") {
            userData.serviceType = userData.serviceType || null
            userData.yearsOfExperience = userData.yearsOfExperience ? Number.parseInt(userData.yearsOfExperience) : null
            userData.serviceDescription = userData.serviceDescription || null

            const parsedRoutes = JSON.parse(userData.routeListings || "[]")
            const processedRoutes = []

            for (let i = 0; i < parsedRoutes.length; i++) {
                const route = parsedRoutes[i]
                const routeData = {
                    fromLocation: route.fromLocation,
                    toLocation: route.toLocation,
                    stops: route.stopPoints || [],
                    inboundStart: route.inboundStart,
                    routeStartDate: route.routeStartDate,
                    oneWayPrice: Number.parseFloat(route.oneWayPrice),
                    roundTripPrice: Number.parseFloat(route.roundTripPrice),
                    monthlyPrice: Number(route.monthlyPrice),
                    totalSeats: Number.parseInt(route.totalSeats),
                    availableSeats: Number.parseInt(route.availableSeats),
                    availableDays: route.availableDays,
                    driverName: route.driverName,
                    nationality: route.nationality,
                    licenseNumber: route.licenseNumber,
                    experience: Number.parseInt(route.experience),
                    vehicleModel: route.vehicleModel,
                    vehiclePlate: route.vehiclePlate,
                    images: [],
                }
                processedRoutes.push(routeData)
            }

            userData.routeListings = processedRoutes
            userData.acceptedPaymentMethods = JSON.parse(userData.acceptedPaymentMethods || "[]")
        }

        if (userData.role === "B2B_PARTNER" || userData.role === "SCHOOL_PARTNER") {
            userData.fleetManagement = []
            userData.acceptedPaymentMethods = JSON.parse(userData.acceptedPaymentMethods || "[]")
        }

        // SCHOOL_CUSTOMER mirrors CORPORATE: no special field parsing is needed
        // beyond the shared company fields already present in registrationData.

        // Add T&C acceptance data to user
        if (registrationData.termsAccepted) {
            userData.termsAndConditions = {
                accepted: true,
                acceptedAt: new Date(),
                version: registrationData.termsVersion || "1.0.0",
                ipAddress: registrationData.termsAcceptedIp || "unknown",
                disclosedCommissionRange: registrationData.disclosedCommissionRange || { min: 0, max: 35 },
            }
        }

        // Every role (including COMMUTER) is auto-logged-in right after OTP
        // verification — there is no admin approval / KYC gate anymore. Stamp
        // lastLogin now so the freshly registered user doesn't show
        // "Last login: Never".
        const newUser = new User(userData)
        newUser.lastLogin = new Date()
        await newUser.save()

        // Persist the durable identity record for COMMUTERs at registration time
        // so the anti-abuse anchor (and the user's identityKey mirror) is saved in
        // the database from day one — not only after a cancellation is incurred.
        if (newUser.role === "COMMUTER") {
            try {
                await registerIdentityLedger(newUser)
            } catch (ledgerErr) {
                console.error("[v0] Failed to persist identity ledger at registration:", ledgerErr.message)
            }
        }

        console.log("[v1] User created and verified successfully:", newUser._id)

        // Real-time alert to all admins about the new registration
        try {
            await sendAdminNotification(
                "New User Registration",
                `${newUser.fullName || newUser.email} registered as ${newUser.role}${newUser.companyName ? ` (${newUser.companyName})` : ""}.`,
                "NEW_USER_REGISTRATION",
                {
                    newUserId: newUser._id,
                    role: newUser.role,
                    email: newUser.email,
                    fullName: newUser.fullName,
                    companyName: newUser.companyName || null,
                }
            )
        } catch (notifyErr) {
            console.error("[v0] Failed to send new-user admin notification:", notifyErr.message)
        }

        // Send welcome email with T&C details for applicable roles
        const rolesRequiringTerms = ["CORPORATE", "B2B_PARTNER", "B2C_PARTNER", "SCHOOL_CUSTOMER", "SCHOOL_PARTNER"]
        if (rolesRequiringTerms.includes(newUser.role) && registrationData.termsAccepted) {
            try {
                await sendWelcomeEmailWithTerms({
                    email: newUser.email,
                    fullName: newUser.fullName,
                    role: newUser.role,
                    termsVersion: registrationData.termsVersion || "1.0.0",
                    commissionRange: registrationData.disclosedCommissionRange || { min: 0, max: 35 },
                    companyName: newUser.companyName,
                })
            } catch (emailError) {
                console.error("Failed to send welcome email:", emailError)
                // Don't fail registration if email fails
            }
        }

        // Generate token (all roles auto-login)
        const token = generateToken(newUser._id, newUser.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(201).json({
            success: true,
            message: "Email verified and registration completed successfully!",
            token,
            // Return the full user (password stripped by toJSON) so the
            // auto-login right after registration has profileImage and every
            // other field. Previously only a few fields were returned, so the
            // freshly-registered user had no profileImage in Redux/localStorage
            // and the navbar/sidebar avatar fell back to initials.
            user: newUser.toJSON(),
        })
    } catch (error) {
        console.error("[v1] OTP verification error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Verification failed",
        })
    }
}

export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            })
        }

        // Check if there's a pending registration
        const existingOTP = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: "registration",
            isUsed: false,
            expiresAt: { $gt: new Date() }
        }).populate('registrationData')

        if (!existingOTP || !existingOTP.registrationData) {
            return res.status(400).json({
                success: false,
                message: "No pending registration found. Please register again.",
            })
        }

        // Generate new OTP
        const newOTP = generateOTP()

        // Update existing record
        existingOTP.otp = newOTP
        existingOTP.attempts = 0
        existingOTP.expiresAt = new Date(Date.now() + 10 * 60 * 1000) // Reset expiry
        await existingOTP.save()

        // Send new OTP email
        const emailResult = await sendVerificationOTP(
            email,
            existingOTP.registrationData.fullName,
            newOTP
        )

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            })
        }

        console.log("[v1] OTP resent for email verification:", { email })

        res.status(200).json({
            success: true,
            message: "New verification code sent to your email",
        })
    } catch (error) {
        console.error("[v1] Resend OTP error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to resend verification code",
        })
    }
}

export const validatePasswordToken = async (req, res) => {
    try {
        const { token } = req.params

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Token is required",
            })
        }

        const user = await User.findOne({
            passwordSetupToken: token,
            passwordSetupTokenExpiry: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token. Please contact your corporate admin for a new invitation.",
            })
        }

        res.status(200).json({
            success: true,
            message: "Token is valid",
            data: {
                email: user.email,
                fullName: user.fullName,
            }
        })
    } catch (error) {
        console.error("Validate password token error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Token validation failed",
        })
    }
}

export const setPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body

        if (!token || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Token, password, and confirm password are required",
            })
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            })
        }

        const user = await User.findOne({
            passwordSetupToken: token,
            passwordSetupTokenExpiry: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token. Please contact your corporate admin for a new invitation.",
            })
        }

        // Update user password and clear the token
        user.password = password // Will be hashed by pre-save hook
        user.passwordSetupToken = null
        user.passwordSetupTokenExpiry = null
        user.isPasswordSet = true
        user.isEmailVerified = true
        await user.save()

        // Generate login token
        const loginToken = generateToken(user._id, user.role)

        res.cookie("token", loginToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Password set successfully! You can now login.",
            token: loginToken,
            user: user.toJSON(),
        })
    } catch (error) {
        console.error("Set password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to set password",
        })
    }
}

export const logout = (req, res) => {
    try {
        // The verifyToken middleware ensures this, so we can proceed safely
        const userId = req.userId // Set by verifyToken middleware

        // Clear the authentication cookie
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        })

        // Clear any other session-related cookies if they exist
        res.clearCookie("session", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        })

        res.status(200).json({
            success: true,
            message: "Logout successful",
            userId, // Confirm which user logged out
        })
    } catch (error) {
        console.error("Logout error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Logout failed",
        })
    }
}

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            })
        }

        // Check if user exists
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email address",
            })
        }

        // Generate OTP
        const otp = generateOTP()

        // Save OTP to database
        await OTP.deleteMany({ email, purpose: "password_reset" })
        const otpRecord = new OTP({
            email,
            otp,
            purpose: "password_reset",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        })
        await otpRecord.save()

        // Send OTP email
        const emailResult = await sendVerificationOTP(email, user.fullName, otp)
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again.",
            })
        }

        res.status(200).json({
            success: true,
            message: "OTP sent to your email address",
        })
    } catch (error) {
        console.error("Forgot password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process request",
        })
    }
}

// Verify Reset OTP
export const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            })
        }

        // Find OTP record
        const otpRecord = await OTP.findOne({
            email,
            otp,
            purpose: "password_reset",
            expiresAt: { $gt: new Date() }
        })

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            })
        }

        // Generate a temporary reset token
        const resetToken = jwt.sign(
            { email, purpose: "password_reset" },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        )

        // Mark OTP as verified but don't delete yet
        otpRecord.isVerified = true
        await otpRecord.save()

        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            resetToken,
        })
    } catch (error) {
        console.error("Verify reset OTP error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to verify OTP",
        })
    }
}

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, reset token, and new password are required",
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            })
        }

        // Verify the reset token
        let decoded
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET)
        } catch (tokenError) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token. Please request a new OTP.",
            })
        }

        if (decoded.email !== email || decoded.purpose !== "password_reset") {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token",
            })
        }

        // Find user
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        // Update password
        user.password = newPassword // Will be hashed by pre-save hook
        await user.save()

        // Delete all OTPs for this email
        await OTP.deleteMany({ email, purpose: "password_reset" })

        res.status(200).json({
            success: true,
            message: "Password reset successful",
        })
    } catch (error) {
        console.error("Reset password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to reset password",
        })
    }
}

// Get user by ID
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params

        const user = await User.findById(id).select('-password -otp')

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                companyLogo: user.companyLogo,
                phone: user.whatsappNumber || user.phone,
                profileImage: user.profileImage,
            }
        })
    } catch (error) {
        console.error("Get user by ID error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get user",
        })
    }
}

// Send suspension appeal email to admin
export const sendSuspensionAppeal = async (req, res) => {
    try {
        const { userEmail, userName, message, adminEmail } = req.body

        if (!userEmail || !userName || !message) {
            return res.status(400).json({
                success: false,
                message: "Email, name, and message are required",
            })
        }

        // Import the email function
        const { sendUserAppealEmail } = await import("../Services/emailService.js")

        // Get admin email if not provided
        let targetAdminEmail = adminEmail
        if (!targetAdminEmail) {
            const adminUser = await User.findOne({ role: "ADMIN" }).select("email").lean()
            targetAdminEmail = adminUser?.email || "admin@driveme.com"
        }

        const result = await sendUserAppealEmail({
            userEmail,
            userName,
            userMessage: message,
            adminEmail: targetAdminEmail
        })

        if (result.success) {
            res.status(200).json({
                success: true,
                message: "Your appeal has been sent to the admin. They will review your request and contact you via email.",
            })
        } else {
            res.status(500).json({
                success: false,
                message: "Failed to send appeal email. Please try again later.",
            })
        }
    } catch (error) {
        console.error("Send suspension appeal error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to send appeal",
        })
    }
}
