import stripe from "../Config/stripe.js"
import tapPayments from "../Config/tapPayments.js"
import CommissionSettings from "../models/CommissionSettings.js"
import { DEFAULT_COMMISSION_PERCENTAGE } from "./HelperUtilities.js"
import {
    normalizeCountry,
    getCountryFromCurrency,
    getCountryPaymentGateway,
} from "../Config/localizationConfig.js"

// Single source of truth for the fallback commission rate (as a decimal), so the
// amount actually charged always matches what the Commission Management screen and
// the payment preview display when a partner has no custom rule configured.
const DEFAULT_COMMISSION_DECIMAL = DEFAULT_COMMISSION_PERCENTAGE / 100

// Calculate commission split - now accepts dynamic rate (0-100%)
// commissionRate should be passed as decimal (e.g., 0.10 for 10%, 0.20 for 20%)
export const calculateCommission = (amount, paymentType = "advance", commissionRate = DEFAULT_COMMISSION_DECIMAL) => {
    if (paymentType === "advance") {
        // Amount here is only the 50% advance (security deposit is handled separately)
        const adminCommission = Math.round(amount * commissionRate * 100) / 100
        const fleetOwnerAmount = Math.round((amount - adminCommission) * 100) / 100
        return { adminCommission, fleetOwnerAmount, appliedRate: commissionRate * 100 }
    } else if (paymentType === "security") {
        // Security deposit goes to platform/admin account, not fleet owner
        const adminCommission = 0
        const fleetOwnerAmount = 0
        return { adminCommission, fleetOwnerAmount, appliedRate: 0 }
    } else if (paymentType === "final") {
        // Final payment: commission to admin, rest to fleet owner
        const adminCommission = Math.round(amount * commissionRate * 100) / 100
        const fleetOwnerAmount = Math.round((amount - adminCommission) * 100) / 100
        return { adminCommission, fleetOwnerAmount, appliedRate: commissionRate * 100 }
    }
}

// Get dynamic commission rate for a B2B Partner (Contract Commission)
export const getB2BPartnerCommissionRate = async (fleetOwnerId) => {
    try {
        const settings = await CommissionSettings.findOne({ userId: fleetOwnerId, isActive: true })
        if (settings) {
            // Check for custom CONTRACT rate first
            const now = new Date()
            const customRate = settings.customRates?.find(
                (r) =>
                    r.rateType === "CONTRACT" &&
                    r.effectiveFrom <= now &&
                    (!r.effectiveUntil || r.effectiveUntil >= now)
            )
            if (customRate) {
                return customRate.rate / 100 // Convert percentage to decimal
            }
            return settings.defaultCommissionRate / 100 // Convert percentage to decimal
        }
        // No settings for this partner: fall back to the platform default (20%),
        // matching the rate shown in Commission Management and the payment preview.
        return DEFAULT_COMMISSION_DECIMAL
    } catch (error) {
        console.error("[v0] Error fetching B2B commission rate:", error)
        return DEFAULT_COMMISSION_DECIMAL
    }
}

// Detect canonical country code from a currency (delegates to central config)
export const detectCountryFromCurrency = (currency) => getCountryFromCurrency(currency)

// Coerce every metadata value to a Stripe-safe string. Stripe silently drops
// metadata keys whose values are not strings (e.g. Mongoose ObjectIds, numbers,
// nested objects), so we stringify them and skip null/undefined entries.
const normalizeStripeMetadata = (metadata = {}) => {
    const safe = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (value === undefined || value === null) continue
        safe[key] = typeof value === "string" ? value : value.toString()
    }
    return safe
}

// Get appropriate gateway based on country.
// Accepts ANY country variant ("KW", "Kuwait", "KUWAIT", "UAE", "AE", ...) and
// resolves it via the central config. UAE -> STRIPE, Kuwait -> TAP, future
// countries per localizationConfig.
export const getPaymentGateway = (country) => {
    return getCountryPaymentGateway(normalizeCountry(country))
}

class PaymentGatewayService {
    // Create payment session based on gateway
    async createPaymentSession(data) {
        const { gateway, amount, currency, customer, contractId, redirectUrl, webhookUrl, metadata } = data

        console.log("[v0] Creating payment session with gateway:", gateway)

        if (gateway === "STRIPE") {
            return await this.createStripePaymentSession({
                amount,
                currency,
                customer,
                contractId,
                redirectUrl,
                metadata,
            })
        } else if (gateway === "TAP") {
            return await this.createTapPaymentSession({
                amount,
                currency,
                customer,
                contractId,
                redirectUrl,
                webhookUrl,
                metadata,
            })
        }

        throw new Error("Unsupported payment gateway")
    }

    // Create Stripe payment session
    async createStripePaymentSession(data) {
        try {
            console.log("[v0] Creating Stripe checkout session")

            // Determine URL separator (? or &) based on whether redirectUrl already has query params
            const urlSeparator = data.redirectUrl.includes('?') ? '&' : '?'
            const cancelSeparator = data.redirectUrl.includes('?') ? '&' : '?'

            // Stripe metadata only accepts flat string values. Passing a Mongoose
            // ObjectId (or any non-string) causes Stripe to silently drop the key,
            // which previously broke monthly-pass renewals (contractId was lost,
            // producing "missing pass id in session metadata"). Normalize every
            // value to a string so nothing is dropped.
            const contractIdStr =
                data.contractId !== undefined && data.contractId !== null
                    ? data.contractId.toString()
                    : undefined
            const safeMetadata = normalizeStripeMetadata({
                contractId: contractIdStr,
                ...data.metadata,
            })

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: data.currency.toLowerCase(),
                            product_data: {
                                name: "Fleet Contract Payment",
                                description: `Payment for contract ${contractIdStr || "N/A"}`,
                            },
                            unit_amount: Math.round(data.amount * 100), // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: `${data.redirectUrl}${urlSeparator}session_id={CHECKOUT_SESSION_ID}&status=success`,
                cancel_url: `${data.redirectUrl}${cancelSeparator}status=cancelled`,
                customer_email: data.customer.email,
                // client_reference_id is a reliable fallback for resolving the pass
                // even if metadata is ever stripped or truncated.
                ...(contractIdStr ? { client_reference_id: contractIdStr } : {}),
                metadata: safeMetadata,
                payment_intent_data: {
                    metadata: safeMetadata,
                },
            })

            console.log("[v0] Stripe session created:", session.id)

            return {
                success: true,
                sessionId: session.id,
                paymentUrl: session.url,
                provider: "STRIPE",
            }
        } catch (error) {
            console.error("[v0] Stripe session creation error:", error.message)
            throw error
        }
    }

    // Create Tap payment session
    async createTapPaymentSession(data) {
        try {
            console.log("[v0] Creating Tap payment charge")

            // Get correct country code based on currency
            const countryCodeMap = {
                "AED": "+971", // UAE
                "KWD": "+965", // Kuwait
                "SAR": "+966", // Saudi Arabia
                "BHD": "+973", // Bahrain
                "OMR": "+968", // Oman
                "QAR": "+974"  // Qatar
            }
            const countryCode = countryCodeMap[data.currency] || "+971"

            const contractIdStr =
                data.contractId !== undefined && data.contractId !== null
                    ? data.contractId.toString()
                    : undefined
            const safeMetadata = normalizeStripeMetadata({
                contractId: contractIdStr,
                ...data.metadata,
            })

            const charge = await tapPayments.createCharge({
                amount: data.amount,
                currency: data.currency,
                customer: {
                    firstName: data.customer.name.split(" ")[0] || "Customer",
                    lastName: data.customer.name.split(" ")[1] || "Name",
                    email: data.customer.email,
                    countryCode: countryCode,
                    phone: data.customer.phone || "5000000000",
                },
                redirectUrl: data.redirectUrl,
                webhookUrl: data.webhookUrl,
                metadata: safeMetadata,
                description: `Payment for contract ${contractIdStr || "N/A"}`,
            })

            console.log("[v0] Tap charge created:", charge.id)

            return {
                success: true,
                sessionId: charge.id,
                paymentUrl: charge.transaction.url,
                provider: "TAP",
            }
        } catch (error) {
            console.error("[v0] Tap charge creation error:", error.message)
            throw error
        }
    }

    // Verify payment based on gateway
    async verifyPayment(gateway, sessionId) {
        console.log("[v0] Verifying payment with gateway:", gateway)

        if (gateway === "STRIPE") {
            return await this.verifyStripePayment(sessionId)
        } else if (gateway === "TAP") {
            return await this.verifyTapPayment(sessionId)
        }

        throw new Error("Unsupported payment gateway")
    }

    // Verify Stripe payment
    async verifyStripePayment(sessionId) {
        try {
            console.log("[v0] Verifying Stripe session:", sessionId)

            const session = await stripe.checkout.sessions.retrieve(sessionId)

            console.log("[v0] Stripe session status:", session.payment_status)

            if (session.payment_status === "paid") {
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent)

                return {
                    success: true,
                    status: "COMPLETED",
                    transactionId: paymentIntent.id,
                    amount: session.amount_total / 100,
                    currency: session.currency.toUpperCase(),
                    metadata: session.metadata,
                    paymentMethod: paymentIntent.payment_method_types[0],
                }
            }

            return {
                success: false,
                status: "FAILED",
                message: "Payment not completed",
            }
        } catch (error) {
            console.error("[v0] Stripe verification error:", error.message)
            throw error
        }
    }

    // Verify Tap payment
    async verifyTapPayment(chargeId) {
        try {
            console.log("[v0] Verifying Tap charge:", chargeId)

            const charge = await tapPayments.retrieveCharge(chargeId)

            console.log("[v0] Tap charge status:", charge.status)

            if (charge.status === "CAPTURED") {
                return {
                    success: true,
                    status: "COMPLETED",
                    transactionId: charge.id,
                    amount: charge.amount,
                    currency: charge.currency.toUpperCase(),
                    metadata: charge.metadata,
                    paymentMethod: charge.source.payment_method,
                }
            }

            return {
                success: false,
                status: "FAILED",
                message: "Payment not captured",
            }
        } catch (error) {
            console.error("[v0] Tap verification error:", error.message)
            throw error
        }
    }

    // Create payout based on gateway
    async createPayout(gateway, data) {
        console.log("[v0] Creating payout with gateway:", gateway)

        if (gateway === "STRIPE") {
            return await this.createStripePayout(data)
        } else if (gateway === "TAP") {
            return await this.createTapPayout(data)
        }

        throw new Error("Unsupported payment gateway")
    }

    // Create Stripe payout
    async createStripePayout(data) {
        try {
            // Note: Requires Stripe Connect setup for payouts
            const payout = await stripe.transfers.create({
                amount: Math.round(data.amount * 100),
                currency: data.currency.toLowerCase(),
                destination: data.destinationAccountId, // Stripe Connect account ID
                metadata: data.metadata,
            })

            return {
                success: true,
                payoutId: payout.id,
                status: "PROCESSING",
            }
        } catch (error) {
            console.error("[v0] Stripe payout error:", error.message)
            throw error
        }
    }

    // Create Tap payout
    async createTapPayout(data) {
        try {
            const transfer = await tapPayments.createTransfer({
                amount: data.amount,
                currency: data.currency,
                destinationId: data.destinationAccountId,
                metadata: data.metadata,
                description: data.description,
            })

            return {
                success: true,
                payoutId: transfer.id,
                status: "PROCESSING",
            }
        } catch (error) {
            console.error("[v0] Tap payout error:", error.message)
            throw error
        }
    }
}

export default new PaymentGatewayService()
