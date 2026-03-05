import stripe from "../Config/stripe.js"
import tapPayments from "../Config/tapPayments.js"

// Calculate commission split
export const calculateCommission = (amount, paymentType = "advance", commissionRate = 0.1) => {
    if (paymentType === "advance") {
        // Amount here is only the 50% advance (security deposit is handled separately)
        const adminCommission = Math.round(amount * commissionRate * 100) / 100
        const fleetOwnerAmount = Math.round((amount - adminCommission) * 100) / 100
        return { adminCommission, fleetOwnerAmount }
    } else if (paymentType === "security") {
        // Security deposit goes to platform/admin account, not fleet owner
        const adminCommission = 0
        const fleetOwnerAmount = 0
        return { adminCommission, fleetOwnerAmount }
    } else if (paymentType === "final") {
        // Final payment: 10% commission to admin, 90% to fleet owner
        const adminCommission = Math.round(amount * commissionRate * 100) / 100
        const fleetOwnerAmount = Math.round((amount - adminCommission) * 100) / 100
        return { adminCommission, fleetOwnerAmount }
    }
}

// Detect country from currency or user data
export const detectCountryFromCurrency = (currency) => {
    const currencyToCountry = {
        AED: "UAE",
        KWD: "KW",
        SAR: "SA",
        BHD: "BH",
        OMR: "OM",
        QAR: "QA",
    }
    return currencyToCountry[currency] || "UAE"
}

// Get appropriate gateway based on country
export const getPaymentGateway = (country) => {
    // UAE → Stripe
    // Kuwait → Tap Payments
    // Other GCC → Stripe (can be customized)
    if (country === "KW") {
        return "TAP"
    }
    return "STRIPE"
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

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: data.currency.toLowerCase(),
                            product_data: {
                                name: "Fleet Contract Payment",
                                description: `Payment for contract ${data.contractId}`,
                            },
                            unit_amount: Math.round(data.amount * 100), // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: `${data.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
                cancel_url: `${data.redirectUrl}?status=cancelled`,
                customer_email: data.customer.email,
                metadata: {
                    contractId: data.contractId,
                    ...data.metadata,
                },
                payment_intent_data: {
                    metadata: {
                        contractId: data.contractId,
                        ...data.metadata,
                    },
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

            const charge = await tapPayments.createCharge({
                amount: data.amount,
                currency: data.currency,
                customer: {
                    firstName: data.customer.name.split(" ")[0] || "Customer",
                    lastName: data.customer.name.split(" ")[1] || "Name",
                    email: data.customer.email,
                    countryCode: "+965", // Kuwait code, adjust based on actual user
                    phone: data.customer.phone || "50000000",
                },
                redirectUrl: data.redirectUrl,
                webhookUrl: data.webhookUrl,
                metadata: {
                    contractId: data.contractId,
                    ...data.metadata,
                },
                description: `Payment for contract ${data.contractId}`,
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
