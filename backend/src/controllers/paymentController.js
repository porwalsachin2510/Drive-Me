import Payment from "../models/Payment.js"
import Wallet from "../models/Wallet.js"
import Transaction from "../models/Transaction.js"
import Contract from "../models/Contract.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import Notification from "../models/Notification.js"
import User from "../models/User.js"
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js"
import paymentGatewayService, {
    calculateCommission,
    detectCountryFromCurrency,
    getPaymentGateway,
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

        const { adminCommission, fleetOwnerAmount } = calculateCommission(advancePaymentAmount, paymentType)

        console.log("[v0] Admin Commission (10% of advance):", adminCommission)
        console.log("[v0] Fleet Owner Amount (90% of advance):", fleetOwnerAmount)
        console.log("[v0] Security Deposit (held separately):", securityDepositAmount)

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
                    redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment/verify`,
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
                    adminCommission,
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
                adminCommission,
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
                contract.paymentStatus = "PAID"
                contract.activationDate = new Date()
            } else if (payment.paymentType === "final") {
                contract.status = "COMPLETED"
                contract.paymentStatus = "PAID"
                contract.completedAt = new Date()
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

                if (userId) {
                    // Find user's wallet
                    let wallet = await Wallet.findOne({ userId })

                    if (!wallet) {
                        // Create wallet if doesn't exist
                        const User = (await import("../models/User.js")).default
                        const user = await User.findById(userId)
                        wallet = await Wallet.create({
                            userId,
                            role: user?.role || "COMMUTER",
                            balance: 0,
                            currency: session.currency?.toUpperCase() || "AED",
                        })
                    }

                    // Check if this payment was already processed (by reference or session ID)
                    const existingTransaction = wallet.transactions?.find(
                        t => t.paymentSessionId === session.id || t.reference === reference
                    )

                    if (!existingTransaction) {
                        const amountToAdd = session.amount_total / 100 // Convert from cents

                        // Add transaction to wallet
                        const transaction = {
                            type: "DEPOSIT",
                            amount: amountToAdd,
                            description: `Funds added via Stripe (webhook)`,
                            paymentMethod: "card",
                            status: "COMPLETED",
                            paymentSessionId: session.id,
                            gatewayTransactionId: session.payment_intent,
                            reference: reference,
                            createdAt: new Date()
                        }

                        wallet.transactions.push(transaction)
                        wallet.balance += amountToAdd
                        await wallet.save()

                        console.log("[v0] Wallet top-up processed from Stripe webhook:", {
                            userId,
                            amountAdded: amountToAdd,
                            newBalance: wallet.balance
                        })
                    } else {
                        console.log("[v0] Wallet top-up already processed, skipping")
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
                    contract.paymentStatus = "PAID"
                    contract.activationDate = new Date()
                } else if (payment.paymentType === "final") {
                    contract.status = "COMPLETED"
                    contract.paymentStatus = "PAID"
                    contract.completedAt = new Date()
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
const processPaymentToWallets = async (payment) => {
    console.log("[v0] Processing payment to wallets:", payment._id)
    console.log("[v0] Payment currency:", payment.currency)

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

    // Send real-time notifications for online payment completion
    const corporateUser = await User.findById(payment.corporateOwnerId).select('fullName companyName')
    const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

    // Notification for B2B Partner - Payment Received
    const b2bNotification = await createNotification({
        userId: payment.fleetOwnerId,
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `${corporateName} has completed ${payment.paymentType} payment of ${payment.fleetOwnerAmount} ${payment.currency} (your share: 90% of advance). Payment method: Online (${payment.paymentMethod}). Contract: ${contract.contractNumber}.${contract.status === "ACTIVE" ? " Contract is now ACTIVE!" : ""}`,
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
