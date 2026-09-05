import Payment from "../models/Payment.js"
import Wallet from "../models/Wallet.js"
import { getOrCreateWallet, resolvePlatformAdminId } from "../Services/walletService.js"
import Transaction from "../models/Transaction.js"
import Contract from "../models/Contract.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import B2CMonthlyPass from "../models/B2CMonthlyPass.js"
import Notification from "../models/Notification.js"
import User from "../models/User.js"
import AdminNegotiation from "../models/AdminNegotiation.js"
import EMIPayment from "../models/EMIPayment.js"
import ProcessedPayment from "../models/ProcessedPayment.js"
import ExtraServiceRequest from "../models/ExtraServiceRequest.js"
import Invoice from "../models/Invoice.js"
import { creditAdminNegotiationCommission } from "./walletController.js"
import { createNotification, sendRealTimeNotification, sendAdminNotification, sendPassActivatedNotification } from "../Services/notificationService.js"
import paymentGatewayService, {
    calculateCommission,
    detectCountryFromCurrency,
    getPaymentGateway,
    getB2BPartnerCommissionRate,
} from "../Services/paymentGatewayService.js"
import crypto from "crypto"
import stripe from "stripe"

// Normalize payment method strings between DB format and code format
// DB stores: "Cash", "Credit Card", "Bank Transfer", "Mobile Wallet"
// Code uses: "CASH", "CARD", "BANK_TRANSFER", "WALLET"
const PAYMENT_METHOD_MAP = {
    "Cash": "CASH",
    "Credit Card": "CARD",
    "Bank Transfer": "BANK_TRANSFER",
    "Mobile Wallet": "WALLET",
    "CASH": "CASH",
    "CARD": "CARD",
    "BANK_TRANSFER": "BANK_TRANSFER",
    "WALLET": "WALLET",
    "KNET": "KNET",
    "APPLE_PAY": "APPLE_PAY",
    "GOOGLE_PAY": "GOOGLE_PAY",
}

const normalizePaymentMethod = (method) => {
    return PAYMENT_METHOD_MAP[method] || method
}

const normalizeAcceptedMethods = (methods) => {
    if (!methods || !Array.isArray(methods)) return []
    return methods.map(normalizePaymentMethod)
}

// Create payment for contract (Advance + Security Deposit combined)
export const createPayment = async (req, res) => {
    try {
        console.log("[v0] Create payment request received")
        const { contractId } = req.params
        const { paymentMethod, paymentType = "advance", currency: bodyCurrency } = req.body
        const corporateOwnerId = req.userId

        // Normalize the incoming payment method
        const normalizedMethod = normalizePaymentMethod(paymentMethod)

        console.log("[v0] Contract ID:", contractId)
        console.log("[v0] Payment Method (original):", paymentMethod)
        console.log("[v0] Payment Method (normalized):", normalizedMethod)
        console.log("[v0] Payment Type:", paymentType)
        console.log("[v0] Currency (from body, if any):", bodyCurrency)

        const contract = await Contract.findById(contractId)
            .populate("corporateOwnerId")
            .populate("fleetOwnerId")
            .populate("quotationId")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // The contract's stored currency is authoritative — it determines the
        // payment gateway (KWD -> TAP, AED -> Stripe). We never trust a default
        // from the request body, so a Kuwait contract can never hit Stripe.
        const currency =
            contract.financials?.currency ||
            contract.currency ||
            bodyCurrency ||
            "AED"

        // Verify contract is ready for payment
        if (contract.status !== "PENDING_PAYMENT" && contract.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Contract is not ready for payment. Both parties must sign first.",
            })
        }

        // Verify corporate owner
        if (contract.corporateOwnerId._id.toString() !== corporateOwnerId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to make payment for this contract",
            })
        }

        // Check if fleet owner accepts this payment method (normalize both sides for comparison)
        const fleetOwner = contract.fleetOwnerId
        const normalizedAccepted = normalizeAcceptedMethods(fleetOwner.acceptedPaymentMethods)
        console.log("[v0] Fleet owner accepted methods (raw):", fleetOwner.acceptedPaymentMethods)
        console.log("[v0] Fleet owner accepted methods (normalized):", normalizedAccepted)

        if (!normalizedAccepted.length || !normalizedAccepted.includes(normalizedMethod)) {
            return res.status(400).json({
                success: false,
                message: `Fleet owner does not accept ${paymentMethod}`,
            })
        }

        let advancePaymentAmount = 0
        let securityDepositAmount = 0
        let totalPaymentAmount = 0
        let paymentDescription = ""

        if (paymentType === "advance") {
            // Check if advance already paid
            if (contract.financials.advancePayment.paidAt) {
                return res.status(400).json({
                    success: false,
                    message: "Advance payment already completed",
                })
            }

            advancePaymentAmount = contract.financials.advancePayment.amount
            securityDepositAmount = contract.financials.securityDeposit.amount
            totalPaymentAmount = advancePaymentAmount + securityDepositAmount

            paymentDescription = `Advance Payment (50% = ${advancePaymentAmount}) + Security Deposit (10% = ${securityDepositAmount}) for Contract ${contract.contractNumber}`

            console.log("[v0] Advance Payment Amount:", advancePaymentAmount)
            console.log("[v0] Security Deposit Amount:", securityDepositAmount)
            console.log("[v0] Total Charge:", totalPaymentAmount)
        } else if (paymentType === "final") {
            // Check if advance is paid first
            if (!contract.financials.advancePayment.paidAt) {
                return res.status(400).json({
                    success: false,
                    message: "Advance payment must be completed before final payment",
                })
            }
            if (contract.financials.finalPayment?.paidAt) {
                return res.status(400).json({
                    success: false,
                    message: "Final payment already completed",
                })
            }
            advancePaymentAmount = contract.financials.remainingAmount
            securityDepositAmount = 0
            totalPaymentAmount = advancePaymentAmount
            paymentDescription = `Final Payment (50%) for Contract ${contract.contractNumber}`
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid payment type. Must be 'advance' or 'final'",
            })
        }

        console.log("[v0] Total Payment Amount:", totalPaymentAmount)
        console.log("[v0] Payment Description:", paymentDescription)

        // Get dynamic commission rate for B2B Partner (Fleet Owner)
        const commissionRate = await getB2BPartnerCommissionRate(contract.fleetOwnerId._id)
        console.log("[v0] Dynamic Commission Rate for Fleet Owner:", commissionRate * 100, "%")

        const { adminCommission, fleetOwnerAmount, appliedRate } = calculateCommission(advancePaymentAmount, paymentType, commissionRate)

        console.log("[v0] Admin Commission (" + appliedRate + "% of advance):", adminCommission)
        console.log("[v0] Fleet Owner Amount (" + (100 - appliedRate) + "% of advance):", fleetOwnerAmount)
        console.log("[v0] Security Deposit (held separately):", securityDepositAmount)

        // Check if there's negotiation commission to add
        let negotiationCommissionAmount = 0
        if (paymentType === "advance" && contract.negotiationCommission && contract.negotiationCommission.commissionStatus === "PENDING") {
            negotiationCommissionAmount = contract.negotiationCommission.adminCommission || 0
            console.log("[v0] Adding Negotiation Commission:", negotiationCommissionAmount)

            // Add negotiation commission to total payment amount
            // Corporate pays: contract amount + negotiation commission for Admin's service
            totalPaymentAmount = totalPaymentAmount + negotiationCommissionAmount
            paymentDescription = paymentDescription + ` + Negotiation Service Fee (${negotiationCommissionAmount})`

            console.log("[v0] Updated Total Payment Amount (with negotiation commission):", totalPaymentAmount)
        }

        // NOTE: adminCommission should ONLY be the regular 10% commission
        // The negotiation commission is tracked separately in negotiationCommissionAmount
        // and is credited to admin wallet separately via creditAdminNegotiationCommission
        // DO NOT add negotiationCommissionAmount to adminCommission to avoid double credit!
        // Check if payment already exists
        const existingPayment = await Payment.findOne({
            contractId,
            paymentType,
            status: { $in: ["PENDING", "PROCESSING", "COMPLETED"] },
        })

        if (existingPayment) {
            return res.status(400).json({
                success: false,
                message: `${paymentType} payment already exists for this contract`,
                data: { payment: existingPayment },
            })
        }

        const country = detectCountryFromCurrency(currency)
        const gateway = getPaymentGateway(country)

        console.log("[v0] Detected Country:", country)
        console.log("[v0] Selected Gateway:", gateway)

        const reference = `FLT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

        console.log("[v0] Payment Reference:", reference)

        if (["CARD", "WALLET", "KNET", "APPLE_PAY", "GOOGLE_PAY"].includes(normalizedMethod)) {
            try {
                const paymentSession = await paymentGatewayService.createPaymentSession({
                    gateway,
                    amount: totalPaymentAmount,
                    currency,
                    customer: {
                        email: contract.corporateOwnerId.email,
                        name: contract.corporateOwnerId.name,
                        phone: contract.corporateOwnerId.phone,
                    },
                    contractId,
            redirectUrl: `${(process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim()}/payment/callback`,
                    metadata: {
                        paymentType,
                        advanceAmount: advancePaymentAmount,
                        securityDeposit: securityDepositAmount,
                    },
                })

                const payment = new Payment({
                    contractId,
                    corporateOwnerId,
                    fleetOwnerId: contract.fleetOwnerId._id,
                    amount: totalPaymentAmount,
                    advanceAmount: advancePaymentAmount,
                    securityDepositAmount: securityDepositAmount,
                    adminCommission, // Only regular 10% commission, NOT including negotiation commission
                    appliedCommissionRate: appliedRate, // Store dynamic commission rate
                    fleetOwnerAmount,
                    currency,
                    paymentType,
                    paymentMethod: normalizedMethod,
                    description: paymentDescription,
                    paymentProvider: gateway,
                    gatewaySessionId: paymentSession.sessionId,
                    paymentMetadata: {
                        paymentUrl: paymentSession.paymentUrl,
                        country,
                    },
                    status: "PROCESSING",
                    verificationStatus: "PENDING",
                    negotiationCommissionAmount, // Track negotiation commission separately (credited via creditAdminNegotiationCommission)
                })

                await payment.save()

                console.log("[v0] Payment record created:", payment._id)

                return res.status(200).json({
                    success: true,
                    message: "Payment session created successfully",
                    data: {
                        payment: {
                            _id: payment._id,
                            contractId: payment.contractId,
                            amount: payment.amount,
                            advanceAmount: payment.advanceAmount,
                            securityDepositAmount: payment.securityDepositAmount,
                            currency: payment.currency,
                            paymentType: payment.paymentType,
                            status: payment.status,
                        },
                        paymentSession: paymentSession,
                    },
                })
            } catch (error) {
                console.error("[v0] Payment session creation error:", error.message)
                return res.status(500).json({
                    success: false,
                    message: "Failed to create payment session",
                    error: error.message,
                })
            }
        } else if (normalizedMethod === "BANK_TRANSFER" || normalizedMethod === "CASH") {
            const payment = new Payment({
                contractId,
                corporateOwnerId,
                fleetOwnerId: contract.fleetOwnerId._id,
                amount: totalPaymentAmount,
                advanceAmount: advancePaymentAmount,
                securityDepositAmount: securityDepositAmount,
                adminCommission, // Only regular 10% commission, NOT including negotiation commission
                appliedCommissionRate: appliedRate, // Store dynamic commission rate
                fleetOwnerAmount,
                currency,
                paymentType,
                paymentMethod: normalizedMethod,
                description: paymentDescription,
                paymentProvider: "MANUAL",
                status: "PENDING",
                verificationStatus: "PENDING",
                paymentMetadata: {
                    reference,
                    bankName: req.body.bankName || null,
                    accountNumber: req.body.accountNumber || null,
                },
                negotiationCommissionAmount, // Track negotiation commission separately (credited via creditAdminNegotiationCommission)
            })

            await payment.save()

            console.log("[v0] Manual payment record created:", payment._id)

            // Get user names for notifications
            const corporateUser = await User.findById(corporateOwnerId).select('fullName companyName')
            const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

            // Send notification to B2B Partner about payment submitted
            const b2bNotification = await createNotification({
                userId: contract.fleetOwnerId._id,
                type: "PAYMENT_SUBMITTED",
                title: "Payment Submitted",
                message: `${corporateName} has submitted a ${normalizedMethod === 'CASH' ? 'cash' : 'bank transfer'} payment of ${totalPaymentAmount} ${currency} for contract ${contract.contractNumber}. Awaiting admin verification.`,
                metadata: {
                    paymentId: payment._id,
                    contractId: contract._id,
                    contractNumber: contract.contractNumber,
                    amount: totalPaymentAmount,
                    currency,
                    paymentMethod: normalizedMethod,
                    paymentType,
                    reference,
                },
            })
            sendRealTimeNotification(contract.fleetOwnerId._id.toString(), b2bNotification)

            // Send notification to Admin
            await sendAdminNotification(
                "New Cash/Bank Payment Requires Verification",
                `${corporateName} submitted ${normalizedMethod} payment of ${totalPaymentAmount} ${currency} for contract ${contract.contractNumber}. Please verify the payment.`,
                "PAYMENT_PENDING_VERIFICATION",
                {
                    paymentId: payment._id,
                    contractId: contract._id,
                    corporateId: corporateOwnerId,
                    fleetOwnerId: contract.fleetOwnerId._id,
                    amount: totalPaymentAmount,
                    currency,
                    paymentMethod: normalizedMethod,
                }
            )

            return res.status(200).json({
                success: true,
                message: "Payment record created. Awaiting admin verification.",
                data: {
                    payment: {
                        _id: payment._id,
                        contractId: payment.contractId,
                        amount: payment.amount,
                        advanceAmount: payment.advanceAmount,
                        securityDepositAmount: payment.securityDepositAmount,
                        currency: payment.currency,
                        paymentType: payment.paymentType,
                        status: payment.status,
                        reference,
                    },
                },
            })
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method",
            })
        }
    } catch (error) {
        console.error("[v0] Create payment error:", error)
        return res.status(500).json({
            success: false,
            message: "Error creating payment",
            error: error.message,
        })
    }
}

export const verifyPayment = async (req, res) => {
    try {
        console.log("[v0] Verify payment request received")
        const { session_id, provider } = req.query

        console.log("[v0] Session ID:", session_id)
        console.log("[v0] Provider:", provider)

        if (!session_id || !provider) {
            return res.status(400).json({
                success: false,
                message: "Missing session_id or provider",
            })
        }

        // Find payment by session ID (for contract payments)
        const payment = await Payment.findOne({
            gatewaySessionId: session_id,
        })

        // If no contract payment found, check for an extra-service-day payment.
        // These are settled from the gateway session id stored on the request.
        if (!payment) {
            const esr = await ExtraServiceRequest.findOne({ gatewaySessionId: session_id })
            if (esr) {
                console.log("[v0] Verifying extra-service-day payment:", esr._id.toString())
                const esrRedirect = `/corporate/contracts/${esr.contractId}`
                try {
                    const verification = await paymentGatewayService.verifyPayment(
                        provider.toUpperCase(),
                        session_id
                    )
                    if (verification.success) {
                        const { settleExtraServiceRequestPayment } = await import(
                            "./extraServiceRequestController.js"
                        )
                        await settleExtraServiceRequestPayment(esr, {
                            method: esr.paymentMethod,
                            provider: provider.toUpperCase(),
                            transactionId: verification.transactionId,
                        })
                        return res.status(200).json({
                            success: true,
                            message: "Extra service day payment completed successfully.",
                            paymentType: "extra_service",
                            data: { redirectUrl: esrRedirect },
                        })
                    }
                    return res.status(200).json({
                        success: false,
                        message: "Extra service day payment not completed yet. Please try again.",
                        paymentType: "extra_service",
                        data: { redirectUrl: esrRedirect },
                    })
                } catch (esrError) {
                    console.error("[v0] Extra-service verification error:", esrError.message)
                    return res.status(200).json({
                        success: false,
                        message: "We could not verify your extra service day payment. Please contact support.",
                        paymentType: "extra_service",
                        data: { redirectUrl: esrRedirect },
                    })
                }
            }

            // If still nothing, check for an operational (managed monthly) invoice
            // payment — settled from the gateway session id stored on the invoice.
            const opsInvoice = await Invoice.findOne({ gatewaySessionId: session_id, type: "OPERATIONAL" })
            if (opsInvoice) {
                console.log("[v0] Verifying operational invoice payment:", opsInvoice._id.toString())
                const invRedirect = `/corporate/contracts/${opsInvoice.contractId}`
                try {
                    const verification = await paymentGatewayService.verifyPayment(
                        provider.toUpperCase(),
                        session_id
                    )
                    if (verification.success) {
                        const { settleOperationalInvoicePayment } = await import(
                            "./managedServiceController.js"
                        )
                        await settleOperationalInvoicePayment(opsInvoice, {
                            method: opsInvoice.paymentMethod,
                            provider: provider.toUpperCase(),
                            transactionId: verification.transactionId,
                        })
                        return res.status(200).json({
                            success: true,
                            message: "Operational invoice payment completed successfully.",
                            paymentType: "operational_invoice",
                            data: { redirectUrl: invRedirect },
                        })
                    }
                    return res.status(200).json({
                        success: false,
                        message: "Operational invoice payment not completed yet. Please try again.",
                        paymentType: "operational_invoice",
                        data: { redirectUrl: invRedirect },
                    })
                } catch (invError) {
                    console.error("[v0] Operational invoice verification error:", invError.message)
                    return res.status(200).json({
                        success: false,
                        message: "We could not verify your invoice payment. Please contact support.",
                        paymentType: "operational_invoice",
                        data: { redirectUrl: invRedirect },
                    })
                }
            }

            console.log("[v0] No contract payment found, checking bookings...")

            // For bookings, we need to retrieve the session from Stripe to get booking info
            if (provider.toUpperCase() === "STRIPE") {
                const stripeClient = stripe(process.env.STRIPE_SECRET_KEY)
                const session = await stripeClient.checkout.sessions.retrieve(session_id)

                console.log("[v0] Stripe session retrieved:", session.id)
                console.log("[v0] Session metadata:", session.metadata)

                // Monthly pass renewal: activate the renewed pass, settle earnings,
                // and generate the daily trips for the renewed window.
                //
                // This branch is AUTHORITATIVE: once we know this is a renewal we
                // ALWAYS return a renewal response (success or failure) and never
                // fall through to the booking branch below, otherwise the commuter
                // would be wrongly redirected to /commuter/my-bookings.
                if (session.metadata?.renewal === "true") {
                    if (session.payment_status !== "paid") {
                        return res.status(200).json({
                            success: false,
                            message: "Renewal payment not completed yet. Please try again.",
                            paymentType: "renewal",
                            data: { redirectUrl: "/commuter-profile?tab=subscription-settings" },
                        })
                    }

                    let renewedPassId = session.metadata?.contractId || session.client_reference_id
                    // Final fallback: the pass stores its in-flight gateway session id,
                    // so we can still resolve it even if metadata was lost on an older
                    // session created before the metadata fix.
                    if (!renewedPassId) {
                        const passBySession = await B2CMonthlyPass.findOne({
                            gatewaySessionId: session.id,
                        }).select("_id")
                        if (passBySession) {
                            renewedPassId = passBySession._id.toString()
                            console.log(
                                "[v0] Renewal verify: resolved pass via gatewaySessionId fallback",
                                renewedPassId
                            )
                        }
                    }
                    if (!renewedPassId) {
                        console.error("[v0] Renewal verify: missing pass id in session metadata", session.id)
                        return res.status(200).json({
                            success: false,
                            message: "Renewal could not be matched to a pass. Please contact support.",
                            paymentType: "renewal",
                            data: { redirectUrl: "/commuter-profile?tab=subscription-settings" },
                        })
                    }

                    try {
                        const { activateCardRenewalPass } = await import(
                            "./subscriptionSettingsController.js"
                        )
                        const activated = await activateCardRenewalPass(renewedPassId, session.id)
                        return res.status(200).json({
                            success: true,
                            message: "Monthly pass renewal verified successfully",
                            paymentType: "renewal",
                            data: {
                                pass: activated,
                                redirectUrl: "/commuter-profile?tab=subscription-settings",
                            },
                        })
                    } catch (renewalError) {
                        console.error("[v0] Renewal activation failed:", renewalError.message)
                        return res.status(200).json({
                            success: false,
                            message: "We received your payment but could not activate the renewal automatically. Our team has been notified.",
                            paymentType: "renewal",
                            data: { redirectUrl: "/commuter-profile?tab=subscription-settings" },
                        })
                    }
                }

                if (session.payment_status === "paid" && session.metadata?.bookingId) {
                    const booking = await B2CPassengerBooking.findById(session.metadata.bookingId)

                    if (booking) {
                        // Update booking payment status if not already completed
                        if (booking.paymentStatus !== "COMPLETED") {
                            booking.paymentStatus = "COMPLETED"
                            booking.transactionId = session.payment_intent
                            await booking.save()

                            // Notify partner about confirmed booking IN REAL TIME.
                            // (Previously this used Notification.create() directly,
                            // which saved to the DB but never emitted a socket event,
                            // so the partner only saw it after a page refresh.)
                            await createNotification({
                                recipientId: booking.b2cPartnerId,
                                userId: booking.b2cPartnerId,
                                type: "NEW_BOOKING",
                                title: "New Paid Booking",
                                message: `Payment received for booking. Amount: AED ${booking.paymentAmount}`,
                                data: {
                                    bookingId: booking._id,
                                    paymentAmount: booking.paymentAmount,
                                },
                            })

                            // Activate the linked monthly pass and notify the commuter
                            // in real time that their card payment succeeded.
                            if (booking.monthlyPassId) {
                                try {
                                    const pass = await B2CMonthlyPass.findById(booking.monthlyPassId)
                                    if (pass && pass.paymentStatus !== "PAID") {
                                        pass.paymentStatus = "PAID"
                                        pass.status = "ACTIVE"
                                        await pass.save()
                                    }
                                    await sendPassActivatedNotification(booking.monthlyPassId)
                                } catch (passErr) {
                                    console.error("[v0] Pass activation after card payment failed:", passErr?.message)
                                }
                            }
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Booking payment verified successfully",
                            paymentType: "booking",
                            data: {
                                booking,
                                redirectUrl: `/commuter/my-bookings/${booking._id}`
                            },
                        })
                    }
                } else if (session.payment_status === "paid") {
                    // Payment succeeded but no bookingId in metadata - still return success
                    return res.status(200).json({
                        success: true,
                        message: "Payment verified successfully",
                        paymentType: "booking",
                        data: {
                            sessionId: session_id,
                            redirectUrl: "/commuter/my-bookings"
                        },
                    })
                }
            }

            return res.status(404).json({
                success: false,
                message: "Payment not found",
            })
        }

        if (payment.status === "COMPLETED") {
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
                data: { payment },
            })
        }

        // Verify with appropriate gateway
        const verificationResult = await paymentGatewayService.verifyPayment(provider.toUpperCase(), session_id)

        console.log("[v0] Verification result:", verificationResult)

        if (verificationResult.success && verificationResult.status === "COMPLETED") {
            // Update payment status
            payment.status = "COMPLETED"
            payment.gatewayTransactionId = verificationResult.transactionId
            payment.verifiedAt = new Date()
            payment.paymentMetadata = {
                ...payment.paymentMetadata,
                paymentMethod: verificationResult.paymentMethod,
            }
            await payment.save()

            console.log("[v0] Payment verified and updated:", payment._id)

            // Process payment and update wallets
            await processPaymentToWallets(payment)

            // Update contract status
            const contract = await Contract.findById(payment.contractId)
            if (payment.paymentType === "advance") {
                contract.status = "ACTIVE"
                contract.financials.paymentStatus = "PARTIAL"
                contract.activationDate = new Date()

                // Update advance payment details
                contract.financials.advancePayment.paidAt = new Date()
                contract.financials.advancePayment.dueDate = contract.financials.advancePayment.dueDate || new Date()
                contract.financials.advancePayment.transactionId = payment.gatewayTransactionId || payment._id.toString()

                // Update security deposit details
                if (payment.securityDepositAmount > 0) {
                    contract.financials.securityDeposit.paidAt = new Date()
                    contract.financials.securityDeposit.dueDate = contract.financials.securityDeposit.dueDate || new Date()
                    contract.financials.securityDeposit.status = "PAID"
                }
            } else if (payment.paymentType === "final") {
                contract.status = "COMPLETED"
                contract.financials.paymentStatus = "COMPLETED"
                contract.completedAt = new Date()

                // Update final payment details
                contract.financials.finalPayment.paidAt = new Date()
                contract.financials.finalPayment.dueDate = contract.financials.finalPayment.dueDate || new Date()
                contract.financials.finalPayment.transactionId = payment.gatewayTransactionId || payment._id.toString()
                contract.financials.remainingAmount = 0
            }
            await contract.save()

            console.log("[v0] Contract status updated:", contract._id)

            // Sync invoices after payment verification
            try {
                const { syncInvoicesForContract } = await import("../Services/invoiceService.js")
                const populatedContract = await Contract.findById(contract._id)
                    .populate("corporateOwnerId", "fullName companyName email")
                    .populate("fleetOwnerId", "fullName companyName email")
                await syncInvoicesForContract(populatedContract)
                console.log("[v0] Invoices synced after payment verification for contract:", contract._id)
            } catch (syncErr) {
                console.error("[v0] Invoice sync after payment verification (non-fatal):", syncErr.message)
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified successfully",
                data: { payment, contract },
            })
        } else {
            payment.status = "FAILED"
            payment.failureReason = verificationResult.message || "Payment verification failed"
            await payment.save()

            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
                error: verificationResult.message,
            })
        }
    } catch (error) {
        console.error("[v0] Error verifying payment:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to verify payment",
            error: error.message,
        })
    }
}

// Get the commission preview for a contract BEFORE payment.
// Returns the exact rate + admin/fleet-owner split the backend will actually apply,
// so the payment modal never shows a hardcoded/guessed percentage.
export const getContractCommissionPreview = async (req, res) => {
    try {
        const { contractId } = req.params

        const contract = await Contract.findById(contractId)
            .populate("fleetOwnerId", "_id")
            .populate("quotationId")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        const currency =
            contract.financials?.currency || contract.currency || "AED"

        // Advance is 50% of the total contract amount (security deposit excluded).
        const advanceAmount = contract.financials?.advancePayment?.amount || 0
        const securityDeposit = contract.financials?.securityDeposit?.amount || 0

        // Same resolution the real payment uses: custom CONTRACT rate -> partner
        // default -> platform default (20%).
        const commissionRate = await getB2BPartnerCommissionRate(contract.fleetOwnerId._id)
        const { adminCommission, fleetOwnerAmount, appliedRate } = calculateCommission(
            advanceAmount,
            "advance",
            commissionRate
        )

        // Pending negotiation service fee (charged on top of the advance, if any).
        let negotiationCommission = 0
        let negotiationCommissionStatus = null
        if (contract.negotiationCommission) {
            negotiationCommission = contract.negotiationCommission.adminCommission || 0
            negotiationCommissionStatus = contract.negotiationCommission.commissionStatus || null
        }

        return res.status(200).json({
            success: true,
            data: {
                currency,
                advanceAmount,
                securityDeposit,
                appliedCommissionRate: appliedRate,
                adminCommission,
                fleetOwnerAmount,
                negotiationCommission,
                negotiationCommissionStatus,
            },
        })
    } catch (error) {
        console.error("[v0] Error building commission preview:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to load commission preview",
            error: error.message,
        })
    }
}

// Get payment by contract ID
export const getPaymentByContract = async (req, res) => {
    try {
        const { contractId } = req.params

        const payment = await Payment.findOne({ contractId })
            .populate("corporateOwnerId", "username email")
            .populate("fleetOwnerId", "username email")

        // Return 200 with null payment instead of 404 when no payment exists yet
        // This prevents frontend errors when contract has no payment yet
        return res.status(200).json({
            success: true,
            data: { payment: payment || null },
        })
    } catch (error) {
        console.error("[v0] Error fetching payment:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment",
            error: error.message,
        })
    }
}

export const stripeWebhook = async (req, res) => {
    try {
        console.log("[v0] Stripe webhook received")
        const sig = req.headers["stripe-signature"]

        let event

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_PAYMENT_WEBHOOK_SECRET)
        } catch (err) {
            console.log("[v0] Webhook signature verification failed:", err.message)
            return res.status(400).send(`Webhook Error: ${err.message}`)
        }

        console.log("[v0] Stripe event type:", event.type)

        if (event.type === "checkout.session.completed") {
            const session = event.data.object

            console.log("[v0] Stripe session metadata:", session.metadata)

            // Check if this is a wallet top-up payment
            if (session.metadata?.type === "WALLET_TOPUP") {
                console.log("[v0] Processing wallet top-up from Stripe webhook")
                const userId = session.metadata?.userId
                const reference = session.metadata?.reference
                const amountToAdd = session.amount_total / 100 // Convert from cents

                if (userId) {
                    // CRITICAL: Atomic duplicate prevention using ProcessedPayment collection
                    // Try to insert - if duplicate key error, payment was already processed
                    try {
                        await ProcessedPayment.create({
                            paymentSessionId: session.id,
                            gatewayTransactionId: session.payment_intent,
                            userId,
                            amount: amountToAdd,
                            currency: session.currency?.toUpperCase() || "AED",
                            gateway: 'STRIPE',
                            processedBy: 'WEBHOOK',
                            processedAt: new Date()
                        })
                        console.log("[v0] Webhook: Payment session marked as processed:", session.id)
                    } catch (error) {
                        // Check if it's a duplicate key error (E11000)
                        if (error.code === 11000 || error.message?.includes('duplicate key')) {
                            console.log("[v0] Webhook: Payment already processed (atomic check):", session.id)
                            return res.json({ received: true })
                        }
                        // Log but don't fail for other errors - webhook should still acknowledge
                        console.error("[v0] Webhook: Error checking ProcessedPayment:", error.message)
                    }

                    // Create transaction object
                    const transaction = {
                        type: "DEPOSIT",
                        amount: amountToAdd,
                        description: `Funds added via card`,
                        paymentMethod: "card",
                        status: "COMPLETED",
                        paymentSessionId: session.id,
                        gatewayTransactionId: session.payment_intent,
                        reference: reference,
                        createdAt: new Date()
                    }

                    // Find or create wallet and add transaction
                    let wallet = await Wallet.findOne({ userId })

                    if (!wallet) {
                        // Create new wallet with initial transaction
                        const user = await User.findById(userId)
                        wallet = await Wallet.create({
                            userId,
                            role: user?.role || "COMMUTER",
                            balance: amountToAdd,
                            currency: session.currency?.toUpperCase() || "AED",
                            transactions: [transaction]
                        })
                        console.log("[v0] Webhook: Created new wallet:", {
                            userId,
                            balance: wallet.balance
                        })
                    } else {
                        // Add transaction to existing wallet
                        wallet.transactions.push(transaction)
                        wallet.balance += amountToAdd
                        await wallet.save()
                        console.log("[v0] Webhook: Wallet top-up processed:", {
                            userId,
                            amountAdded: amountToAdd,
                            newBalance: wallet.balance
                        })
                    }
                }

                return res.json({ received: true })
            }

            // Check if this is an EMI payment
            if (session.metadata?.paymentType === "EMI") {
                console.log("[v0] Processing EMI payment from Stripe webhook")
                const emiPaymentId = session.metadata?.emiPaymentId
                const installmentNumber = parseInt(session.metadata?.installmentNumber)

                if (emiPaymentId && installmentNumber) {
                    // IDEMPOTENCY: Use atomic findOneAndUpdate to prevent duplicate processing
                    // The verify endpoint will handle wallet crediting, webhook is just a backup
                    const emiPayment = await EMIPayment.findOneAndUpdate(
                        {
                            _id: emiPaymentId,
                            "installments.installmentNumber": installmentNumber,
                            "installments.status": { $ne: "PAID" },
                            "installments.verificationStatus": { $nin: ["VERIFIED", "PROCESSING"] }
                        },
                        {
                            $set: {
                                "installments.$.verificationStatus": "WEBHOOK_PROCESSING"
                            }
                        },
                        { new: true }
                    )
                        .populate("contractId")
                        .populate("corporateOwnerId")
                        .populate("fleetOwnerId")

                    if (emiPayment) {
                        const installment = emiPayment.installments.find(
                            i => i.installmentNumber === installmentNumber
                        )

                        if (installment) {
                            // Update installment status (wallet crediting is handled by verify endpoint)
                            installment.status = "PAID"
                            installment.paidAt = new Date()
                            installment.transactionId = session.payment_intent
                            installment.gatewaySessionId = session.id
                            installment.verificationStatus = "VERIFIED"

                            // Update EMI summary
                            emiPayment.paidInstallments = emiPayment.installments.filter(
                                i => i.status === "PAID"
                            ).length
                            emiPayment.totalPaid = emiPayment.installments
                                .filter(i => i.status === "PAID")
                                .reduce((sum, i) => sum + i.amount, 0)
                            emiPayment.remainingAmount = emiPayment.totalAmount - emiPayment.totalPaid

                            // Check if all installments are paid
                            if (emiPayment.paidInstallments === emiPayment.totalInstallments) {
                                emiPayment.status = "COMPLETED"
                            }

                            // Update next due date
                            const nextPending = emiPayment.installments.find(i => i.status === "PENDING")
                            if (nextPending) {
                                emiPayment.nextDueDate = nextPending.dueDate
                            } else {
                                emiPayment.nextDueDate = null
                            }

                            await emiPayment.save()

                            console.log("[v0] EMI payment processed from Stripe webhook:", {
                                emiPaymentId,
                                installmentNumber,
                                transactionId: session.payment_intent
                            })
                        }
                    } else {
                        console.log("[v0] EMI installment already processed or not found")
                    }
                }

                return res.json({ received: true })
            }

            // Monthly pass renewal: extend the pass in place + generate trips.
            // This is the reliable backup path in case the browser never hit the
            // verify endpoint. activateCardRenewalPass is idempotent via the
            // gateway session id, so it is safe even if verify already ran.
            if (session.metadata?.renewal === "true") {
                console.log("[v0] Processing monthly pass renewal from Stripe webhook")
                const renewedPassId = session.metadata?.contractId || session.client_reference_id
                if (renewedPassId) {
                    try {
                        const { activateCardRenewalPass } = await import("./subscriptionSettingsController.js")
                        await activateCardRenewalPass(renewedPassId, session.id)
                        console.log("[v0] Renewal activated from Stripe webhook for pass:", renewedPassId)
                    } catch (renewalError) {
                        console.error("[v0] Webhook renewal activation failed:", renewalError.message)
                    }
                }
                return res.json({ received: true })
            }

            // Extra service day payment: settle the request the session belongs to.
            // settleExtraServiceRequestPayment is idempotent (no-ops if already
            // PAID), so it is safe even if the browser callback settled it first.
            if (session.metadata?.type === "EXTRA_SERVICE") {
                console.log("[v0] Processing extra-service-day payment from Stripe webhook")
                const esr = await ExtraServiceRequest.findOne({ gatewaySessionId: session.id })
                if (esr) {
                    try {
                        const { settleExtraServiceRequestPayment } = await import("./extraServiceRequestController.js")
                        await settleExtraServiceRequestPayment(esr, {
                            method: esr.paymentMethod,
                            provider: "STRIPE",
                            transactionId: session.payment_intent,
                        })
                    } catch (esrError) {
                        console.error("[v0] Webhook extra-service settlement failed:", esrError.message)
                    }
                }
                return res.json({ received: true })
            }

            // Operational (managed monthly) invoice payment: settle the invoice the
            // session belongs to. settleOperationalInvoicePayment is idempotent, so
            // it is safe even if the browser callback settled it first.
            if (session.metadata?.type === "OPERATIONAL_INVOICE") {
                console.log("[v0] Processing operational invoice payment from Stripe webhook")
                const opsInvoice = await Invoice.findOne({ gatewaySessionId: session.id, type: "OPERATIONAL" })
                if (opsInvoice) {
                    try {
                        const { settleOperationalInvoicePayment } = await import("./managedServiceController.js")
                        await settleOperationalInvoicePayment(opsInvoice, {
                            method: opsInvoice.paymentMethod,
                            provider: "STRIPE",
                            transactionId: session.payment_intent,
                        })
                    } catch (invError) {
                        console.error("[v0] Webhook operational invoice settlement failed:", invError.message)
                    }
                }
                return res.json({ received: true })
            }

            // Handle contract payment
            const payment = await Payment.findOne({ gatewaySessionId: session.id })

            if (payment && payment.status !== "COMPLETED") {
                payment.status = "COMPLETED"
                payment.gatewayTransactionId = session.payment_intent
                payment.verifiedAt = new Date()
                await payment.save()

                await processPaymentToWallets(payment)

                const contract = await Contract.findById(payment.contractId)
                if (payment.paymentType === "advance") {
                    contract.status = "ACTIVE"
                    contract.financials.paymentStatus = "PARTIAL"
                    contract.activationDate = new Date()

                    // Update advance payment details
                    contract.financials.advancePayment.paidAt = new Date()
                    contract.financials.advancePayment.dueDate = contract.financials.advancePayment.dueDate || new Date()
                    contract.financials.advancePayment.transactionId = payment.gatewayTransactionId || payment._id.toString()

                    // Update security deposit details
                    if (payment.securityDepositAmount > 0) {
                        contract.financials.securityDeposit.paidAt = new Date()
                        contract.financials.securityDeposit.dueDate = contract.financials.securityDeposit.dueDate || new Date()
                        contract.financials.securityDeposit.status = "PAID"
                    }
                } else if (payment.paymentType === "final") {
                    contract.status = "COMPLETED"
                    contract.financials.paymentStatus = "COMPLETED"
                    contract.completedAt = new Date()

                    // Update final payment details
                    contract.financials.finalPayment.paidAt = new Date()
                    contract.financials.finalPayment.dueDate = contract.financials.finalPayment.dueDate || new Date()
                    contract.financials.finalPayment.transactionId = payment.gatewayTransactionId || payment._id.toString()
                    contract.financials.remainingAmount = 0
                }
                await contract.save()

                console.log("[v0] Payment processed from Stripe webhook:", payment._id)
            }
        }

        return res.json({ received: true })
    } catch (error) {
        console.error("[v0] Stripe webhook error:", error)
        return res.status(500).json({ error: "Webhook processing failed" })
    }
}

export const tapWebhook = async (req, res) => {
    try {
        console.log("[v0] Tap webhook received")
        const payload = req.body

        console.log("[v0] Tap webhook payload:", payload)

        if (payload.object === "charge" && payload.status === "CAPTURED") {
            const chargeId = payload.id
            const metadata = payload.metadata || {}

            // Check if this is an EMI payment
            if (metadata.paymentType === "EMI") {
                console.log("[v0] Processing EMI payment from Tap webhook")
                const emiPaymentId = metadata.emiPaymentId
                const installmentNumber = parseInt(metadata.installmentNumber)

                if (emiPaymentId && installmentNumber) {
                    // IDEMPOTENCY: Use atomic findOneAndUpdate
                    const emiPayment = await EMIPayment.findOneAndUpdate(
                        {
                            _id: emiPaymentId,
                            "installments.installmentNumber": installmentNumber,
                            "installments.status": { $ne: "PAID" },
                            "installments.verificationStatus": { $nin: ["VERIFIED", "PROCESSING"] }
                        },
                        {
                            $set: {
                                "installments.$.verificationStatus": "WEBHOOK_PROCESSING"
                            }
                        },
                        { new: true }
                    )
                        .populate("contractId")
                        .populate("corporateOwnerId")

                    if (emiPayment) {
                        const installment = emiPayment.installments.find(
                            i => i.installmentNumber === installmentNumber
                        )

                        if (installment) {
                            installment.status = "PAID"
                            installment.paidAt = new Date()
                            installment.transactionId = chargeId
                            installment.gatewaySessionId = chargeId
                            installment.verificationStatus = "VERIFIED"

                            emiPayment.paidInstallments = emiPayment.installments.filter(
                                i => i.status === "PAID"
                            ).length
                            emiPayment.totalPaid = emiPayment.installments
                                .filter(i => i.status === "PAID")
                                .reduce((sum, i) => sum + i.amount, 0)
                            emiPayment.remainingAmount = emiPayment.totalAmount - emiPayment.totalPaid

                            if (emiPayment.paidInstallments === emiPayment.totalInstallments) {
                                emiPayment.status = "COMPLETED"
                            }

                            const nextPending = emiPayment.installments.find(i => i.status === "PENDING")
                            if (nextPending) {
                                emiPayment.nextDueDate = nextPending.dueDate
                            } else {
                                emiPayment.nextDueDate = null
                            }

                            await emiPayment.save()
                            console.log("[v0] EMI payment processed from Tap webhook:", { emiPaymentId, installmentNumber })
                        }
                    } else {
                        console.log("[v0] EMI payment already processed or not found")
                    }
                }

                return res.status(200).json({ status: "success" })
            }

            // Monthly pass renewal (Tap / Kuwait): extend the pass in place +
            // generate trips. Idempotent via the gateway session id.
            if (metadata.renewal === "true") {
                console.log("[v0] Processing monthly pass renewal from Tap webhook")
                const renewedPassId = metadata.contractId
                if (renewedPassId) {
                    try {
                        const { activateCardRenewalPass } = await import("./subscriptionSettingsController.js")
                        await activateCardRenewalPass(renewedPassId, chargeId)
                        console.log("[v0] Renewal activated from Tap webhook for pass:", renewedPassId)
                    } catch (renewalError) {
                        console.error("[v0] Tap webhook renewal activation failed:", renewalError.message)
                    }
                }
                return res.status(200).json({ status: "success" })
            }

            // Extra service day payment (Tap / Kuwait). Idempotent settlement.
            if (metadata.type === "EXTRA_SERVICE") {
                console.log("[v0] Processing extra-service-day payment from Tap webhook")
                const esr = await ExtraServiceRequest.findOne({ gatewaySessionId: chargeId })
                if (esr) {
                    try {
                        const { settleExtraServiceRequestPayment } = await import("./extraServiceRequestController.js")
                        await settleExtraServiceRequestPayment(esr, {
                            method: esr.paymentMethod,
                            provider: "TAP",
                            transactionId: chargeId,
                        })
                    } catch (esrError) {
                        console.error("[v0] Tap webhook extra-service settlement failed:", esrError.message)
                    }
                }
                return res.status(200).json({ status: "success" })
            }

            // Operational (managed monthly) invoice payment (Tap / Kuwait).
            if (metadata.type === "OPERATIONAL_INVOICE") {
                console.log("[v0] Processing operational invoice payment from Tap webhook")
                const opsInvoice = await Invoice.findOne({ gatewaySessionId: chargeId, type: "OPERATIONAL" })
                if (opsInvoice) {
                    try {
                        const { settleOperationalInvoicePayment } = await import("./managedServiceController.js")
                        await settleOperationalInvoicePayment(opsInvoice, {
                            method: opsInvoice.paymentMethod,
                            provider: "TAP",
                            transactionId: chargeId,
                        })
                    } catch (invError) {
                        console.error("[v0] Tap webhook operational invoice settlement failed:", invError.message)
                    }
                }
                return res.status(200).json({ status: "success" })
            }

            const payment = await Payment.findOne({ gatewaySessionId: chargeId })

            if (payment && payment.status !== "COMPLETED") {
                payment.status = "COMPLETED"
                payment.gatewayTransactionId = chargeId
                payment.verifiedAt = new Date()
                await payment.save()

                await processPaymentToWallets(payment)

                const contract = await Contract.findById(payment.contractId)
                if (payment.paymentType === "advance") {
                    contract.status = "ACTIVE"
                    contract.paymentStatus = "PAID"
                    contract.activationDate = new Date()
                } else if (payment.paymentType === "final") {
                    contract.status = "COMPLETED"
                    contract.paymentStatus = "PAID"
                    contract.completedAt = new Date()
                }
                await contract.save()

                console.log("[v0] Payment processed from Tap webhook:", payment._id)
            }
        }

        return res.status(200).json({ status: "success" })
    } catch (error) {
        console.error("[v0] Tap webhook error:", error)
        return res.status(500).json({ error: "Webhook processing failed" })
    }
}

// Process payment to wallets (existing function)
// IDEMPOTENT: This function checks if wallets were already credited to prevent duplicates
const processPaymentToWallets = async (payment) => {
    console.log("[v0] Processing payment to wallets:", payment._id)
    console.log("[v0] Payment currency:", payment.currency)

    // IDEMPOTENCY CHECK: Prevent duplicate wallet credits
    // Re-fetch payment to get latest state (in case webhook and verify endpoint race)
    const latestPayment = await Payment.findById(payment._id)
    if (latestPayment.walletCredited) {
        console.log("[v0] Wallets already credited for payment:", payment._id)
        console.log("[v0] Wallet credited at:", latestPayment.walletCreditedAt)
        return { success: true, message: "Wallets already credited", alreadyProcessed: true }
    }

    // Atomically mark as processing to prevent race conditions
    const updateResult = await Payment.findOneAndUpdate(
        { _id: payment._id, walletCredited: { $ne: true } },
        { $set: { walletCredited: true, walletCreditedAt: new Date() } },
        { new: true }
    )

    if (!updateResult) {
        console.log("[v0] Payment already being processed or credited by another request")
        return { success: true, message: "Already being processed", alreadyProcessed: true }
    }

    console.log("[v0] Wallet credit lock acquired for payment:", payment._id)

    // Resolve wallets in the PAYMENT'S currency so a UAE (AED) payment credits
    // the AED wallets and a Kuwait (KWD) payment credits the KWD wallets. The
    // old code found "the user's single wallet" regardless of currency, which is
    // how foreign amounts ended up mislabeled under the wrong currency.
    const walletCurrency = payment.currency || "AED"
    // Resolve the REAL platform admin instead of blindly trusting
    // process.env.ADMIN_USER_ID (which produced the ghost "Unknown" ADMIN wallet
    // when the env var was stale). If no admin exists we skip the credit rather
    // than mint an orphan wallet.
    const adminUserId = await resolvePlatformAdminId()
    if (!adminUserId) {
        console.error("[v0] Skipping admin commission credit: no platform admin resolved")
        // Release the walletCredited lock we acquired above so the credit can be
        // retried once a real admin account exists — otherwise the payment would
        // be marked credited forever without anyone actually receiving funds.
        await Payment.findByIdAndUpdate(payment._id, {
            $set: { walletCredited: false },
            $unset: { walletCreditedAt: "" },
        })
        return {
            success: false,
            message: "Platform admin account not found; commission not credited.",
        }
    }
    let adminWallet = await getOrCreateWallet(adminUserId, {
        currency: walletCurrency,
        role: "ADMIN",
    })
    if (adminWallet.isNew) await adminWallet.save()

    // Get or create the partner (fleet owner) wallet using their REAL role, so a
    // School Partner's wallet is labelled SCHOOL_PARTNER, not hardcoded as a B2B
    // partner. Falls back to B2B_PARTNER only if the user can't be resolved.
    const fleetOwner = await User.findById(payment.fleetOwnerId).select("role").lean()
    const fleetWalletRole = fleetOwner?.role || "B2B_PARTNER"
    let fleetWallet = await getOrCreateWallet(payment.fleetOwnerId, {
        currency: walletCurrency,
        role: fleetWalletRole,
    })
    // Keep an existing wallet's role in sync if the user's role was corrected.
    if (!fleetWallet.isNew && fleetOwner?.role && fleetWallet.role !== fleetOwner.role) {
        fleetWallet.role = fleetOwner.role
    }
    if (fleetWallet.isNew) await fleetWallet.save()

    // Log currency info for debugging
    console.log("[v0] Fleet Wallet currency:", fleetWallet.currency)
    console.log("[v0] Payment currency:", payment.currency)

    console.log("[v0] Admin Wallet:", adminWallet._id)
    console.log("[v0] Fleet Wallet:", fleetWallet._id)

    // Credit admin wallet with commission
    const adminBalanceBefore = adminWallet.balance
    adminWallet.balance += payment.adminCommission
    adminWallet.totalEarnings += payment.adminCommission
    await adminWallet.save()

    await Transaction.create({
        walletId: adminWallet._id,
        userId: adminUserId,
        type: "CREDIT",
        amount: payment.adminCommission,
        currency: payment.currency || "KWD",
        category: "COMMISSION_EARNED",
        description: `Commission from ${payment.paymentType} payment - Contract ${payment.contractId}`,
        referenceId: payment._id,
        referenceModel: "Payment",
        balanceBefore: adminBalanceBefore,
        balanceAfter: adminWallet.balance,
    })

    console.log("[v0] Admin wallet credited:", payment.adminCommission)

    // Credit fleet owner wallet
    const fleetBalanceBefore = fleetWallet.balance
    fleetWallet.balance += payment.fleetOwnerAmount
    fleetWallet.totalEarnings += payment.fleetOwnerAmount
    await fleetWallet.save()

    await Transaction.create({
        walletId: fleetWallet._id,
        userId: payment.fleetOwnerId,
        type: "CREDIT",
        amount: payment.fleetOwnerAmount,
        currency: payment.currency || "KWD",
        category: "PAYMENT_RECEIVED",
        description: `${payment.paymentType} payment received for contract ${payment.contractId}`,
        referenceId: payment._id,
        referenceModel: "Payment",
        balanceBefore: fleetBalanceBefore,
        balanceAfter: fleetWallet.balance,
    })

    console.log("[v0] Fleet owner wallet credited:", payment.fleetOwnerAmount)

    const contract = await Contract.findById(payment.contractId)

    if (payment.paymentType === "advance") {
        contract.financials.advancePayment.paidAt = new Date()
        contract.financials.advancePayment.transactionId = payment.gatewayTransactionId || payment.gatewayReference
        contract.status = "ACTIVE"
        contract.activatedAt = new Date()
        contract.statusHistory.push({
            status: "ACTIVE",
            changedBy: payment.corporateOwnerId,
            reason: "Advance payment (50%) completed",
        })
    } else if (payment.paymentType === "final") {
        contract.financials.finalPayment = {
            amount: payment.amount,
            paidAt: new Date(),
            transactionId: payment.gatewayTransactionId || payment.gatewayReference,
        }
        contract.status = "COMPLETED"
        contract.completedAt = new Date()
        contract.statusHistory.push({
            status: "COMPLETED",
            changedBy: payment.corporateOwnerId,
            reason: "Final payment (50%) completed",
        })
    } else if (payment.paymentType === "security") {
        contract.financials.securityDeposit.paidAt = new Date()
        contract.financials.securityDeposit.transactionId = payment.gatewayTransactionId || payment.gatewayReference
    }

    await contract.save()
    console.log("[v0] Contract updated with payment info")

    // Update negotiation commission status to PAID if payment is advance (first payment)
    // AND credit the commission to Admin wallet
    // Check if not already paid to avoid duplicate credits
    if (payment.paymentType === "advance" && contract.negotiationCommission) {
        try {
            const negotiationCommission = contract.negotiationCommission

            // Check if commission is already PAID to avoid double credit
            if (negotiationCommission.commissionStatus === "PAID") {
                console.log("[v0] Negotiation commission already PAID, skipping wallet credit")
            } else {
                const commissionAmount = negotiationCommission.adminCommission || 0

                // Update contract commission status
                await Contract.findByIdAndUpdate(
                    contract._id,
                    { "negotiationCommission.commissionStatus": "PAID" },
                    { new: true }
                )
                console.log("[v0] Contract negotiation commission status marked as PAID")

                // Also update AdminNegotiation status if exists
                if (negotiationCommission.negotiationId) {
                    // Get the negotiation details to find the admin who completed it
                    const negotiation = await AdminNegotiation.findById(negotiationCommission.negotiationId)

                    if (negotiation) {
                        // Check if negotiation commission is already paid
                        if (negotiation.adminCommissionFromCorporate?.status === "PAID") {
                            console.log("[v0] AdminNegotiation commission already PAID, skipping wallet credit")
                        } else {
                            // Update negotiation commission status
                            await AdminNegotiation.findByIdAndUpdate(
                                negotiationCommission.negotiationId,
                                {
                                    "adminCommissionFromCorporate.status": "PAID",
                                    "adminCommissionFromCorporate.paidAt": new Date()
                                },
                                { new: true }
                            )
                            console.log("[v0] AdminNegotiation commission marked as PAID")

                            // Credit Admin wallet if commission amount > 0
                            if (commissionAmount > 0 && negotiation.completedBy) {
                                const corporateUser = await User.findById(payment.corporateOwnerId).select('fullName companyName')
                                const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

                                const creditResult = await creditAdminNegotiationCommission({
                                    adminUserId: negotiation.completedBy,
                                    amount: commissionAmount,
                                    currency: payment.currency || contract.financials.currency || "AED",
                                    corporateUserId: payment.corporateOwnerId,
                                    corporateName: corporateName,
                                    negotiationId: negotiation._id,
                                    contractId: contract._id,
                                    contractNumber: contract.contractNumber
                                })

                                if (creditResult.success) {
                                    console.log("[v0] Admin wallet credited with negotiation commission:", {
                                        adminId: negotiation.completedBy,
                                        amount: commissionAmount,
                                        newBalance: creditResult.newBalance
                                    })
                                } else {
                                    console.error("[v0] Failed to credit admin wallet:", creditResult.message)
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[v0] Error updating negotiation commission status:", err)
        }
    }

    // Send real-time notifications for online payment completion
    const corporateUser = await User.findById(payment.corporateOwnerId).select('fullName companyName')
    const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

    // Notification for B2B Partner - Payment Received (with dynamic commission rate)
    const fleetOwnerSharePercent = 100 - (payment.appliedCommissionRate || 10)
    const b2bNotification = await createNotification({
        userId: payment.fleetOwnerId,
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `${corporateName} has completed ${payment.paymentType} payment of ${payment.fleetOwnerAmount} ${payment.currency} (your share: ${fleetOwnerSharePercent}% of advance). Payment method: Online (${payment.paymentMethod}). Contract: ${contract.contractNumber}.${contract.status === "ACTIVE" ? " Contract is now ACTIVE!" : ""}`,
        metadata: {
            paymentId: payment._id,
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            totalAmount: payment.amount,
            yourShare: payment.fleetOwnerAmount,
            adminCommission: payment.adminCommission,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            paymentType: payment.paymentType,
            contractStatus: contract.status,
            paidBy: corporateName,
            paidAt: new Date().toISOString(),
            // For online payments, immediate credit
            expectedPayoutDate: new Date().toISOString(),
        },
    })
    sendRealTimeNotification(payment.fleetOwnerId.toString(), b2bNotification)

    // Notification for Corporate - Payment Confirmation
    const corporateNotification = await createNotification({
        userId: payment.corporateOwnerId,
        type: "PAYMENT_COMPLETED",
        title: "Payment Completed",
        message: `Your ${payment.paymentType} payment of ${payment.amount} ${payment.currency} for contract ${contract.contractNumber} has been processed successfully.${contract.status === "ACTIVE" ? " Your contract is now ACTIVE!" : ""}`,
        metadata: {
            paymentId: payment._id,
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            paymentType: payment.paymentType,
            contractStatus: contract.status,
        },
    })
    sendRealTimeNotification(payment.corporateOwnerId.toString(), corporateNotification)

    // If contract became ACTIVE, send contract activation notifications
    if (contract.status === "ACTIVE" && payment.paymentType === "advance") {
        // Notification for Corporate - Contract Activated
        const corporateActivationNotif = await createNotification({
            userId: payment.corporateOwnerId,
            type: "CONTRACT_ACTIVATED",
            title: "Contract Activated",
            message: `Your contract ${contract.contractNumber} is now active! You can now use the assigned vehicles.`,
            metadata: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                startDate: contract.rentalPeriod?.startDate,
                endDate: contract.rentalPeriod?.endDate,
            },
        })
        sendRealTimeNotification(payment.corporateOwnerId.toString(), corporateActivationNotif)

        // Notification for B2B Partner - Contract Activated
        const b2bActivationNotif = await createNotification({
            userId: payment.fleetOwnerId,
            type: "CONTRACT_ACTIVATED",
            title: "Contract Activated",
            message: `Contract ${contract.contractNumber} with ${corporateName} is now active! Please ensure vehicles are ready for the client.`,
            metadata: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                corporateName,
                startDate: contract.rentalPeriod?.startDate,
                endDate: contract.rentalPeriod?.endDate,
            },
        })
        sendRealTimeNotification(payment.fleetOwnerId.toString(), b2bActivationNotif)
    }

    console.log("[v0] Payment notifications sent to both parties")
}


export const createInstallmentPayment = async (req, res) => {
    try {
        const { scheduleItemId } = req.params
        const { paymentMethod } = req.body
        const corporateOwnerId = req.userId

        const paymentSchedule = await PaymentSchedule.findOne({
            "scheduleItems._id": scheduleItemId,
        }).populate("contractId")

        if (!paymentSchedule) {
            return res.status(404).json({
                success: false,
                message: "Payment schedule not found",
            })
        }

        const scheduleItem = paymentSchedule.scheduleItems.id(scheduleItemId)

        if (!scheduleItem) {
            return res.status(404).json({
                success: false,
                message: "Schedule item not found",
            })
        }

        if (scheduleItem.status === "PAID") {
            return res.status(400).json({
                success: false,
                message: "This installment has already been paid",
            })
        }

        if (scheduleItem.status === "OVERDUE") {
            const overdueCharge = scheduleItem.amount * 0.05 // 5% late fee
            scheduleItem.amount += overdueCharge
        }

        const contract = paymentSchedule.contractId
        // Currency from the contract is authoritative for gateway selection.
        const currency = contract.financials?.currency || contract.currency || "AED"

        const { adminCommission, fleetOwnerAmount } = calculateCommission(scheduleItem.amount)

        const country = detectCountryFromCurrency(currency)
        const gateway = getPaymentGateway(country)

        const reference = `INST-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

        const paymentSession = await paymentGatewayService.createPaymentSession({
            gateway,
            amount: scheduleItem.amount,
            currency,
            customer: {
                email: contract.corporateOwnerId.email,
                name: contract.corporateOwnerId.username,
                phone: contract.corporateOwnerId.phone || "",
            },
            contractId: contract._id.toString(),
            redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment/callback`,
            webhookUrl: `${process.env.BACKEND_URL}/api/payments/webhook/${gateway.toLowerCase()}`,
            metadata: {
                contractId: contract._id.toString(),
                corporateOwnerId: corporateOwnerId,
                fleetOwnerId: contract.fleetOwnerId.toString(),
                reference: reference,
                paymentType: "installment",
                scheduleItemId: scheduleItemId,
            },
        })

        const payment = await Payment.create({
            contractId: contract._id,
            corporateOwnerId,
            fleetOwnerId: contract.fleetOwnerId,
            amount: scheduleItem.amount,
            adminCommission,
            fleetOwnerAmount,
            currency,
            paymentMethod,
            paymentType: "installment",
            paymentProvider: gateway,
            gatewaySessionId: paymentSession.sessionId,
            gatewayReference: reference,
            status: "PENDING",
            description: `Installment ${scheduleItem.installmentNumber} for Contract ${contract.contractNumber}`,
            scheduleItemId: scheduleItemId,
            paymentMetadata: {
                paymentUrl: paymentSession.paymentUrl,
                country: country,
            },
        })

        return res.status(201).json({
            success: true,
            message: "Installment payment session created",
            data: {
                payment,
                paymentUrl: paymentSession.paymentUrl,
                provider: gateway,
            },
        })
    } catch (error) {
        console.error("[v0] Error creating installment payment:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to create installment payment",
            error: error.message,
        })
    }
}
