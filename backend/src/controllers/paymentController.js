import Payment from "../models/Payment.js"
import Wallet from "../models/Wallet.js"
import Transaction from "../models/Transaction.js"
import Contract from "../models/Contract.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import Notification from "../models/Notification.js"
import User from "../models/User.js"
import AdminNegotiation from "../models/AdminNegotiation.js"
import EMIPayment from "../models/EMIPayment.js"
import ProcessedPayment from "../models/ProcessedPayment.js"
import { creditAdminNegotiationCommission } from "./walletController.js"
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js"
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
        const { paymentMethod, paymentType = "advance", currency = "AED" } = req.body
        const corporateOwnerId = req.userId

        // Normalize the incoming payment method
        const normalizedMethod = normalizePaymentMethod(paymentMethod)

        console.log("[v0] Contract ID:", contractId)
        console.log("[v0] Payment Method (original):", paymentMethod)
        console.log("[v0] Payment Method (normalized):", normalizedMethod)
        console.log("[v0] Payment Type:", paymentType)
        console.log("[v0] Currency:", currency)

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
                    redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment/callback`,
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

        // If no contract payment found, check for booking payment
        if (!payment) {
            console.log("[v0] No contract payment found, checking bookings...")

            // For bookings, we need to retrieve the session from Stripe to get booking info
            if (provider.toUpperCase() === "STRIPE") {
                const stripeClient = stripe(process.env.STRIPE_SECRET_KEY)
                const session = await stripeClient.checkout.sessions.retrieve(session_id)

                console.log("[v0] Stripe session retrieved:", session.id)
                console.log("[v0] Session metadata:", session.metadata)

                if (session.payment_status === "paid" && session.metadata?.bookingId) {
                    const booking = await B2CPassengerBooking.findById(session.metadata.bookingId)

                    if (booking) {
                        // Update booking payment status if not already completed
                        if (booking.paymentStatus !== "COMPLETED") {
                            booking.paymentStatus = "COMPLETED"
                            booking.transactionId = session.payment_intent
                            await booking.save()

                            // Notify partner about confirmed booking
                            await Notification.create({
                                recipientId: booking.b2cPartnerId,
                                userId: booking.b2cPartnerId,
                                type: "NEW_BOOKING",
                                title: "New Paid Booking",
                                message: `Payment received for booking. Amount: AED ${booking.paymentAmount}`,
                                data: {
                                    bookingId: booking._id,
                                    paymentAmount: booking.paymentAmount,
                                },
                                status: "UNREAD",
                            })
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

    // Get or create admin wallet
    const adminUserId = process.env.ADMIN_USER_ID
    let adminWallet = await Wallet.findOne({ userId: adminUserId })

    if (!adminWallet) {
        adminWallet = await Wallet.create({
            userId: adminUserId,
            role: "ADMIN",
            balance: 0,
            currency: payment.currency || "KWD",
        })
    }

    // Get or create fleet owner wallet with B2B_PARTNER role
    let fleetWallet = await Wallet.findOne({ userId: payment.fleetOwnerId })

    if (!fleetWallet) {
        fleetWallet = await Wallet.create({
            userId: payment.fleetOwnerId,
            role: "B2B_PARTNER",
            balance: 0,
            currency: payment.currency || "KWD",
        })
    }

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
        const currency = contract.currency || "AED"

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
