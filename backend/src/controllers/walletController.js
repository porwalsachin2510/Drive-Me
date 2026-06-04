import Wallet from "../models/Wallet.js"
import User from "../models/User.js"
import Transaction from "../models/Transaction.js"
import WithdrawalRequest from "../models/WithdrawalRequest.js"
import ProcessedPayment from "../models/ProcessedPayment.js"
import { sendRealTimeNotification, notifyAdminsWalletEvent } from "../Services/socketService.js"
import { createNotification } from "./notificationController.js"
import { detectCountryFromCurrency, getPaymentGateway } from "../Services/paymentGatewayService.js"
import { getCountryCurrency, getCurrencyDecimals, getCurrencySymbol, getCountryPaymentMethods } from "../Services/countryLocalizationService.js"
import bankValidationService from "../Services/bankValidationService.js"
import crypto from "crypto"

// Create payment session for wallet funds
export const createPaymentSession = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, paymentMethod, currency = "KWD" } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Payment method is required"
            })
        }

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // Detect country and get gateway
        const country = detectCountryFromCurrency(currency)
        const gateway = getPaymentGateway(country)

        // Create reference
        const reference = `WALLET-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

        // Import payment gateway service
        const paymentGatewayService = await import("../Services/paymentGatewayService.js")

        // Create payment session
        const paymentSession = await paymentGatewayService.default.createPaymentSession({
            gateway,
            amount,
            currency,
            customer: {
                email: user.email,
                name: user.fullName || user.username,
                phone: user.phone,
            },
            contractId: `WALLET-${userId}`,
            redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/wallet/payment/verify`,
            metadata: {
                type: "WALLET_TOPUP",
                userId,
                reference,
            },
        })

        console.log("[v0] Payment session created:", {
            sessionId: paymentSession.sessionId,
            hasPaymentUrl: !!paymentSession.paymentUrl,
            provider: paymentSession.provider
        })


        return res.status(200).json({
            success: true,
            message: "Payment session created successfully",
            data: {
                sessionId: paymentSession.sessionId,
                paymentUrl: paymentSession.paymentUrl,
                reference,
                amount,
                currency,
                paymentMethod,
                gateway: paymentSession.provider || gateway
            }
        })
    } catch (error) {
        console.error("Error creating payment session:", error)
        return res.status(500).json({
            success: false,
            message: "Error creating payment session",
            error: error.message
        })
    }
}

// Get wallet balance
export const getWalletBalance = async (req, res) => {
    try {

        const userId = req.userId
        const userRole = req.userRole

        // Get user details for currency detection
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // Find or create wallet for user
        let wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            // Detect currency based on user location or default to KWD
            let userCurrency = "KWD"
            if (user.country) {
                const countryCurrencyMap = {
                    "UAE": "AED",
                    "KW": "KWD",
                    "KUWAIT": "KWD",
                    "SA": "SAR",
                    "BH": "BHD",
                    "OM": "OMR",
                    "QA": "QAR"
                }
                userCurrency = countryCurrencyMap[user.country] || "KWD"
            }

            // Map role to valid wallet roles - some driver roles don't have wallets
            const validWalletRoles = ["COMMUTER", "CORPORATE", "CORPORATE_EMPLOYEE", "B2C_PARTNER", "B2C_PARTNER_DRIVER", "B2B_PARTNER", "ADMIN"]
            const resolvedRole = validWalletRoles.includes(userRole)
                ? userRole
                : validWalletRoles.includes(user.role)
                    ? user.role
                    : "COMMUTER" // fallback

            wallet = new Wallet({
                userId,
                role: resolvedRole,
                balance: 0, // No default balance for production
                currency: userCurrency,
                transactions: []
            })
            await wallet.save()
        }

        return res.status(200).json({
            success: true,
            data: {
                wallet,
                balance: wallet.balance
            }
        })
    } catch (error) {
        console.error("Error getting wallet balance:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching wallet balance"
        })
    }
}

// Get wallet transactions
export const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.userId
        const { page = 1, limit = 20 } = req.query

        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        const transactions = wallet.transactions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: wallet.transactions.length,
                    pages: Math.ceil(wallet.transactions.length / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting wallet transactions:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching transactions"
        })
    }
}

// Helper function to detect gateway from session ID format
const detectGatewayFromSessionId = (sessionId) => {
    if (!sessionId) return null;

    // Stripe session IDs start with cs_test_ or cs_live_
    if (sessionId.startsWith('cs_test_') || sessionId.startsWith('cs_live_')) {
        return 'STRIPE';
    }

    // Stripe payment intents start with pi_
    if (sessionId.startsWith('pi_')) {
        return 'STRIPE';
    }

    // TAP charge IDs start with chg_
    if (sessionId.startsWith('chg_')) {
        return 'TAP';
    }

    // TAP transaction IDs may start with txn_
    if (sessionId.startsWith('txn_')) {
        return 'TAP';
    }

    // Default to null if cannot detect
    return null;
}

// Add funds to wallet
export const addFundsToWallet = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, paymentMethod, paymentDetails, paymentSessionId, currency = "KWD", gateway: providedGateway } = req.body

        if (!paymentSessionId) {
            return res.status(400).json({
                success: false,
                message: "Payment session ID is required for adding funds"
            })
        }

        // Get user to determine currency
        const user = await User.findById(userId)
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }

        // Use user's currency or fallback to passed currency or KWD
        const userCurrency = currency || getCountryCurrency(user.country) || "KWD"

        // Verify payment session with payment gateway first
        let paymentVerification = null
        let verifiedAmount = amount // Use provided amount if available
        try {
            // Import payment gateway service
            const paymentGatewayService = await import("../Services/paymentGatewayService.js")

            // IMPORTANT: Detect gateway from session ID format first, then fall back to provided gateway or currency-based detection
            // This fixes the issue where Stripe payments were being verified with TAP gateway
            let gateway = detectGatewayFromSessionId(paymentSessionId);

            if (!gateway) {
                // Fall back to provided gateway or detect from currency
                if (providedGateway) {
                    gateway = providedGateway;
                } else {
                    const country = detectCountryFromCurrency(userCurrency)
                    gateway = getPaymentGateway(country)
                }
            }

            console.log("[v0] Verifying payment with gateway:", { gateway, paymentSessionId, userCurrency, detectedFromId: detectGatewayFromSessionId(paymentSessionId) });

            // Verify payment
            paymentVerification = await paymentGatewayService.default.verifyPayment(gateway, paymentSessionId)

            console.log("[v0] Payment verification result:", {
                success: paymentVerification.success,
                status: paymentVerification.status,
                amount: paymentVerification.amount
            });

            if (!paymentVerification.success || paymentVerification.status !== "COMPLETED") {
                return res.status(400).json({
                    success: false,
                    message: "Payment verification failed. Please complete payment first."
                })
            }

            // Use amount from payment verification if provided amount is 0 or missing
            if (!amount || amount <= 0) {
                verifiedAmount = paymentVerification.amount
                if (!verifiedAmount || verifiedAmount <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Payment amount could not be determined"
                    })
                }
            }
        } catch (error) {
            console.error("Payment verification error:", error)
            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Please try again."
            })
        }

        // CRITICAL: Atomic duplicate prevention using ProcessedPayment collection
        // Try to insert the payment session ID - if it already exists, MongoDB will throw a duplicate key error
        // This is the ONLY reliable way to prevent race conditions when two requests hit simultaneously
        try {
            await ProcessedPayment.create({
                paymentSessionId,
                gatewayTransactionId: paymentVerification.transactionId,
                userId,
                amount: verifiedAmount,
                currency: userCurrency,
                gateway: detectGatewayFromSessionId(paymentSessionId) || 'STRIPE',
                processedBy: 'CALLBACK',
                processedAt: new Date()
            })
            console.log("[v0] Payment session marked as processed:", paymentSessionId)
        } catch (error) {
            // Check if it's a duplicate key error (E11000)
            if (error.code === 11000 || error.message?.includes('duplicate key')) {
                console.log("[v0] Payment already processed (atomic check via ProcessedPayment):", paymentSessionId)

                // Find the existing wallet to return
                const existingWallet = await Wallet.findOne({ userId })
                const existingTransaction = existingWallet?.transactions?.find(
                    t => t.paymentSessionId === paymentSessionId ||
                        t.gatewayTransactionId === paymentVerification.transactionId
                )

                return res.status(200).json({
                    success: true,
                    message: "Payment already processed",
                    data: {
                        wallet: existingWallet,
                        transaction: existingTransaction,
                        alreadyProcessed: true
                    }
                })
            }
            // Re-throw other errors
            throw error
        }

        // If we reach here, the payment session was successfully marked as processed
        // Now we can safely add funds to the wallet

        // IMPORTANT: Use atomic operation to prevent race conditions between webhook and callback
        // Both webhook and callback might try to add funds at the same time

        // First, try to atomically update the wallet ONLY if the payment hasn't been processed yet
        // This uses MongoDB's atomic findOneAndUpdate to prevent duplicate transactions
        const transactionId = paymentVerification.transactionId

        // Create the transaction object
        const transaction = {
            type: "DEPOSIT",
            amount: verifiedAmount,
            description: `Funds added via ${paymentMethod || 'card'}`,
            paymentMethod: paymentMethod || 'card',
            status: "COMPLETED",
            paymentSessionId,
            gatewayTransactionId: transactionId,
            createdAt: new Date()
        }

        // Atomically check if transaction exists and add it if not
        // The $not: $elemMatch ensures we only update if no matching transaction exists
        const updateResult = await Wallet.findOneAndUpdate(
            {
                userId,
                // Only update if NO transaction exists with this paymentSessionId OR gatewayTransactionId
                $and: [
                    { "transactions.paymentSessionId": { $ne: paymentSessionId } },
                    { "transactions.gatewayTransactionId": { $ne: transactionId } }
                ]
            },
            {
                $push: { transactions: transaction },
                $inc: { balance: verifiedAmount },
                $setOnInsert: { currency: userCurrency }
            },
            {
                new: true,
                upsert: false // Don't create new wallet here
            }
        )

        // If updateResult is null, either wallet doesn't exist OR transaction was already processed
        if (!updateResult) {
            // Check if wallet exists
            let wallet = await Wallet.findOne({ userId })

            if (!wallet) {
                // Create wallet and add transaction (first time)
                wallet = new Wallet({
                    userId,
                    balance: verifiedAmount,
                    currency: userCurrency,
                    transactions: [transaction]
                })
                await wallet.save()

                console.log("[v0] Created new wallet with funds:", {
                    userId,
                    balance: wallet.balance,
                    paymentSessionId
                })
            } else {
                // Wallet exists but transaction was already processed (duplicate prevention worked!)
                const existingTransaction = wallet.transactions?.find(
                    t => t.paymentSessionId === paymentSessionId ||
                        t.gatewayTransactionId === transactionId
                )

                console.log("[v0] Payment already processed (atomic check), returning existing wallet data:", {
                    paymentSessionId,
                    existingTransactionId: existingTransaction?._id,
                    currentBalance: wallet.balance
                })

                return res.status(200).json({
                    success: true,
                    message: "Payment already processed",
                    data: {
                        wallet,
                        transaction: existingTransaction,
                        alreadyProcessed: true
                    }
                })
            }

            // Send notifications for new wallet
            const walletCurrency = wallet.currency || userCurrency || "KWD"
            await sendRealTimeNotification(userId, {
                type: "WALLET_UPDATED",
                title: "Funds Added",
                message: `${verifiedAmount} ${walletCurrency} has been added to your wallet`,
                data: {
                    newBalance: wallet.balance,
                    currency: walletCurrency,
                    transaction
                }
            })

            return res.status(200).json({
                success: true,
                message: "Funds added successfully",
                data: {
                    wallet,
                    transaction
                }
            })
        }

        // Transaction was added successfully via atomic update
        const wallet = updateResult

        console.log("[v0] Wallet updated:", {
            userId,
            newBalance: wallet.balance,
            addedAmount: verifiedAmount,
            currency: userCurrency
        });

        // Send real-time notification with wallet currency
        const walletCurrency = wallet.currency || userCurrency || "KWD"
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Funds Added",
            message: `${verifiedAmount} ${walletCurrency} has been added to your wallet`,
            data: {
                newBalance: wallet.balance,
                currency: walletCurrency,
                transaction
            }
        })

        // Create notification
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Funds Added Successfully",
            message: `${verifiedAmount} ${walletCurrency} has been added to your wallet via ${paymentMethod || 'payment'}`,
            data: {
                amount: verifiedAmount,
                currency: walletCurrency,
                paymentMethod: paymentMethod || 'card',
                newBalance: wallet.balance
            }
        })

        // Notify admins about wallet fund addition
        const userwallet = await User.findById(userId)
        notifyAdminsWalletEvent('wallet-fund-added', {
            userId,
            userName: userwallet?.fullName || "User",
            userRole: userwallet?.role,
            amount,
            currency: walletCurrency,
            newBalance: wallet.balance,
            transactionType: "DEPOSIT",
            paymentMethod
        })

        return res.status(200).json({
            success: true,
            message: "Funds added successfully",
            data: {
                wallet,
                transaction
            }
        })
    } catch (error) {
        console.error("Error adding funds to wallet:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while adding funds"
        })
    }
}

// Withdraw from wallet
export const withdrawFromWallet = async (req, res) => {
    try {
        const userId = req.userId
        const {
            amount,
            iban,
            bankCode,
            accountHolderName,
            currency = "KWD",
            country = "KW"
        } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // Validate withdrawal details
        const withdrawalValidation = bankValidationService.validateWithdrawalDetails({
            iban,
            bankCode,
            accountHolderName,
            amount,
            currency,
            country
        })

        if (!withdrawalValidation.valid) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal validation failed",
                errors: withdrawalValidation.errors
            })
        }

        // Check withdrawal limits
        const limitCheck = bankValidationService.checkWithdrawalLimits(amount, currency, user.level || "STANDARD")
        if (!limitCheck.valid) {
            return res.status(400).json({
                success: false,
                message: limitCheck.error
            })
        }

        // Find wallet
        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Generate withdrawal reference
        const withdrawalReference = bankValidationService.generateWithdrawalReference(userId)

        // Add transaction
        const transaction = {
            type: "WITHDRAWAL",
            amount: -amount,
            description: `Withdrawal to ${withdrawalValidation.bankName} - ${accountHolderName}`,
            bankAccount: bankValidationService.formatIBAN(iban),
            bankCode,
            bankName: withdrawalValidation.bankName,
            accountHolderName,
            status: "PENDING",
            reference: withdrawalReference,
            processingTime: bankValidationService.getBankProcessingTimes(country),
            createdAt: new Date()
        }

        wallet.transactions.push(transaction)
        wallet.balance -= amount
        wallet.totalWithdrawals += amount
        await wallet.save()

        // Get the wallet transaction ID (last added transaction)
        const walletTransactionId = wallet.transactions[wallet.transactions.length - 1]._id

        // Create WithdrawalRequest for admin to process
        const withdrawalRequest = await WithdrawalRequest.create({
            userId,
            walletId: wallet._id,
            requestId: WithdrawalRequest.generateRequestId(),
            amount,
            currency,
            bankName: withdrawalValidation.bankName,
            bankCode,
            iban: bankValidationService.formatIBAN(iban),
            accountHolderName,
            status: "PENDING",
            userInfo: {
                fullName: user.fullName || user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            walletTransactionId,
            metadata: {
                reference: withdrawalReference,
                processingTime: bankValidationService.getBankProcessingTimes(country),
                country
            }
        })

        console.log("[withdrawFromWallet] Created withdrawal request:", {
            requestId: withdrawalRequest.requestId,
            amount,
            userId,
            bankName: withdrawalValidation.bankName
        })

        // Send real-time notification
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Withdrawal Initiated",
            message: `${amount} ${currency} withdrawal has been initiated to ${withdrawalValidation.bankName}`,
            data: {
                newBalance: wallet.balance,
                transaction,
                processingTime: transaction.processingTime
            }
        })

        // Create notification
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Withdrawal Initiated",
            message: `${amount} ${currency} withdrawal has been initiated to your bank account at ${withdrawalValidation.bankName}`,
            data: {
                amount,
                currency,
                bankName: withdrawalValidation.bankName,
                reference: withdrawalReference,
                processingTime: transaction.processingTime,
                newBalance: wallet.balance
            }
        })

        // Notify admins about wallet withdrawal
        notifyAdminsWalletEvent('wallet-withdrawal', {
            userId,
            userName: user?.fullName || "User",
            userRole: user?.role,
            amount,
            currency,
            newBalance: wallet.balance,
            transactionType: "WITHDRAWAL",
            bankName: withdrawalValidation.bankName,
            reference: withdrawalReference
        })

        return res.status(200).json({
            success: true,
            message: "Withdrawal initiated successfully",
            data: {
                wallet,
                transaction,
                reference: withdrawalReference,
                processingTime: transaction.processingTime
            }
        })
    } catch (error) {
        console.error("Error withdrawing from wallet:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while processing withdrawal"
        })
    }
}

// Transfer funds to another user
export const transferFunds = async (req, res) => {
    try {
        const userId = req.userId
        const { recipientId, amount, description } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        if (!recipientId) {
            return res.status(400).json({
                success: false,
                message: "Recipient ID is required"
            })
        }

        if (recipientId === userId) {
            return res.status(400).json({
                success: false,
                message: "Cannot transfer to yourself"
            })
        }

        // Find sender wallet
        const senderWallet = await Wallet.findOne({ userId })
        if (!senderWallet) {
            return res.status(404).json({
                success: false,
                message: "Sender wallet not found"
            })
        }

        if (senderWallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Find recipient
        const recipient = await User.findById(recipientId)
        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: "Recipient not found"
            })
        }

        // Find or create recipient wallet
        let recipientWallet = await Wallet.findOne({ userId: recipientId })
        if (!recipientWallet) {
            recipientWallet = new Wallet({
                userId: recipientId,
                balance: 0,
                transactions: []
            })
        }

        // Create transactions
        const senderTransaction = {
            type: "TRANSFER",
            amount: -amount,
            description: description || "Fund transfer",
            recipientId,
            recipientName: recipient.fullName,
            status: "COMPLETED",
            createdAt: new Date()
        }

        const recipientTransaction = {
            type: "TRANSFER",
            amount: amount,
            description: description || "Fund transfer",
            senderId: userId,
            senderName: req.user?.fullName || "User",
            status: "COMPLETED",
            createdAt: new Date()
        }

        // Update wallets
        senderWallet.transactions.push(senderTransaction)
        senderWallet.balance -= amount

        recipientWallet.transactions.push(recipientTransaction)
        recipientWallet.balance += amount

        await senderWallet.save()
        await recipientWallet.save()

        // Send notifications to both users
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Transfer Sent",
            message: `${amount} KWD has been sent to ${recipient.fullName}`,
            data: {
                newBalance: senderWallet.balance,
                transaction: senderTransaction
            }
        })

        await sendRealTimeNotification(recipientId, {
            type: "WALLET_UPDATED",
            title: "Transfer Received",
            message: `${amount} KWD has been received from ${req.user?.fullName || "User"}`,
            data: {
                newBalance: recipientWallet.balance,
                transaction: recipientTransaction
            }
        })

        // Create notifications
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Transfer Sent",
            message: `${amount} KWD has been sent to ${recipient.fullName}`,
            data: {
                amount,
                recipientId,
                recipientName: recipient.fullName,
                newBalance: senderWallet.balance
            }
        })

        await createNotification({
            userId: recipientId,
            type: "PAYMENT_RECEIVED",
            title: "Transfer Received",
            message: `${amount} KWD has been received from ${req.user?.fullName || "User"}`,
            relatedUserId: userId,
            data: {
                amount,
                senderId: userId,
                senderName: req.user?.fullName || "User",
                newBalance: recipientWallet.balance
            }
        })

        return res.status(200).json({
            success: true,
            message: "Transfer completed successfully",
            data: {
                wallet: senderWallet,
                transaction: senderTransaction
            }
        })
    } catch (error) {
        console.error("Error transferring funds:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while processing transfer"
        })
    }
}

// Get wallet statement
export const getWalletStatement = async (req, res) => {
    try {
        const userId = req.userId
        const { startDate, endDate, page = 1, limit = 20 } = req.query

        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        // Filter transactions by date range
        let filteredTransactions = wallet.transactions

        if (startDate) {
            const start = new Date(startDate)
            filteredTransactions = filteredTransactions.filter(
                tx => new Date(tx.createdAt) >= start
            )
        }

        if (endDate) {
            const end = new Date(endDate)
            filteredTransactions = filteredTransactions.filter(
                tx => new Date(tx.createdAt) <= end
            )
        }

        // Sort and paginate
        filteredTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        const transactions = filteredTransactions.slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: filteredTransactions.length,
                    pages: Math.ceil(filteredTransactions.length / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting wallet statement:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching wallet statement"
        })
    }
}

// Request payout
export const requestPayout = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, bankAccount, payoutMethod } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        // Find wallet
        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Create payout transaction
        const transaction = {
            type: "PAYOUT",
            amount: -amount,
            description: `Payout request via ${payoutMethod || "bank transfer"}`,
            bankAccount,
            payoutMethod,
            status: "PENDING",
            createdAt: new Date()
        }

        wallet.transactions.push(transaction)
        wallet.balance -= amount
        await wallet.save()

        // Send notification
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Payout Requested",
            message: `${amount} KWD payout request has been submitted`,
            data: {
                newBalance: wallet.balance,
                transaction
            }
        })

        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Payout Requested",
            message: `${amount} KWD payout request has been submitted for processing`,
            data: {
                amount,
                bankAccount,
                payoutMethod,
                newBalance: wallet.balance
            }
        })

        return res.status(200).json({
            success: true,
            message: "Payout request submitted successfully",
            data: {
                wallet,
                transaction
            }
        })
    } catch (error) {
        console.error("Error requesting payout:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while requesting payout"
        })
    }
}

// Get user payouts
export const getUserPayouts = async (req, res) => {
    try {
        const userId = req.userId
        const { page = 1, limit = 20 } = req.query

        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        // Filter payout transactions
        const payouts = wallet.transactions
            .filter(tx => tx.type === "PAYOUT")
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            success: true,
            data: {
                payouts,
                pagination: {
                    page,
                    limit,
                    total: wallet.transactions.filter(tx => tx.type === "PAYOUT").length,
                    pages: Math.ceil(wallet.transactions.filter(tx => tx.type === "PAYOUT").length / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting user payouts:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payouts"
        })
    }
}

// Get payment methods and configuration based on user's country
export const getPaymentConfig = async (req, res) => {
    try {
        const userId = req.userId

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        console.log("[v0] Fetching payment config for user country:", user.country)

        // Get currency and payment methods based on country
        const currency = getCountryCurrency(user.country)
        const decimals = getCurrencyDecimals(currency)
        const symbol = getCurrencySymbol(currency)
        const paymentMethods = getCountryPaymentMethods(user.country)

        return res.status(200).json({
            success: true,
            data: {
                country: user.country,
                currency,
                currencySymbol: symbol,
                decimals,
                paymentMethods,
                message: "Payment configuration retrieved successfully"
            }
        })
    } catch (error) {
        console.error("[v0] Error getting payment config:", error)
        return res.status(500).json({
            success: false,
            message: "Error getting payment configuration",
            error: error.message
        })
    }
}

// Credit negotiation commission to Admin wallet
// This function is called when Corporate pays for a contract that has negotiation commission
export const creditAdminNegotiationCommission = async ({
    adminUserId,
    amount,
    currency,
    corporateUserId,
    corporateName,
    negotiationId,
    contractId,
    contractNumber,
}) => {
    try {
        if (!adminUserId || !amount || amount <= 0) {
            console.error("[v0] Invalid params for crediting admin commission:", { adminUserId, amount })
            return { success: false, message: "Invalid parameters" }
        }

        // Find or create Admin wallet
        let adminWallet = await Wallet.findOne({ userId: adminUserId })
        if (!adminWallet) {
            // Create wallet for admin
            adminWallet = new Wallet({
                userId: adminUserId,
                role: "ADMIN",
                balance: 0,
                currency: currency || "AED",
                transactions: []
            })
        }

        const balanceBefore = adminWallet.balance

        // Add transaction to Admin wallet
        const transaction = {
            type: "DEPOSIT",
            amount: amount,
            description: `Negotiation commission from ${corporateName || 'Corporate'} for contract ${contractNumber || contractId}`,
            status: "COMPLETED",
            senderId: corporateUserId,
            senderName: corporateName,
            createdAt: new Date()
        }

        adminWallet.transactions.push(transaction)
        adminWallet.balance += amount
        adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + amount
        await adminWallet.save()

        // Create detailed Transaction record
        const transactionRecord = new Transaction({
            walletId: adminWallet._id,
            userId: adminUserId,
            type: "CREDIT",
            amount: amount,
            currency: currency || "AED",
            category: "NEGOTIATION_COMMISSION",
            description: `Negotiation commission from ${corporateName || 'Corporate'} for successful price negotiation`,
            referenceId: negotiationId,
            referenceModel: "AdminNegotiation",
            fromUserId: corporateUserId,
            fromName: corporateName,
            toUserId: adminUserId,
            toName: "Admin",
            balanceBefore: balanceBefore,
            balanceAfter: adminWallet.balance,
            metadata: {
                negotiationId,
                contractId,
                contractNumber,
                commissionAmount: amount,
                commissionType: "NEGOTIATION_COMMISSION"
            }
        })
        await transactionRecord.save()

        console.log("[v0] Admin negotiation commission credited:", {
            adminUserId,
            amount,
            currency,
            newBalance: adminWallet.balance,
            negotiationId
        })

        // Send real-time notification to admin
        await sendRealTimeNotification(adminUserId.toString(), {
            type: "WALLET_UPDATED",
            title: "Commission Received",
            message: `You have received ${amount} ${currency || "AED"} commission from ${corporateName || "Corporate"} for negotiation services`,
            data: {
                amount,
                currency: currency || "AED",
                newBalance: adminWallet.balance,
                source: "NEGOTIATION_COMMISSION",
                negotiationId,
                contractId
            }
        })

        // Create notification record
        await createNotification({
            userId: adminUserId,
            type: "PAYMENT_RECEIVED",
            title: "Negotiation Commission Received",
            message: `You have received ${amount} ${currency || "AED"} commission from ${corporateName || "Corporate"} for successful negotiation on contract ${contractNumber || contractId}`,
            data: {
                amount,
                currency: currency || "AED",
                negotiationId,
                contractId,
                contractNumber,
                corporateName,
                newBalance: adminWallet.balance
            }
        })

        return {
            success: true,
            transaction: transactionRecord,
            newBalance: adminWallet.balance
        }
    } catch (error) {
        console.error("[v0] Error crediting admin negotiation commission:", error)
        return { success: false, message: error.message }
    }
}


// Generate valid test IBANs for testing withdrawal
export const generateTestIBAN = async (req, res) => {
    try {
        const { country = "UAE" } = req.query;

        // Pre-calculated valid IBANs with correct MOD-97 checksums
        // These are sample IBANs that pass checksum validation
        const validTestIBANs = {
            UAE: [
                { iban: "AE070330000010111111111", bank: "FAB", bankName: "First Abu Dhabi Bank" },
                { iban: "AE950210000000693123456", bank: "EmiratesNBD", bankName: "Emirates NBD" },
                { iban: "AE440260001015154875001", bank: "ADCB", bankName: "Abu Dhabi Commercial Bank" },
            ],
            KW: [
                { iban: "KW81CBKU0000000000001234560101", bank: "KFH", bankName: "Kuwait Finance House" },
                { iban: "KW91KFHO0000000000001234560001", bank: "KFH", bankName: "Kuwait Finance House" },
            ]
        };

        const testIBANs = validTestIBANs[country.toUpperCase()] || validTestIBANs.UAE;

        res.status(200).json({
            success: true,
            message: "Test IBANs for withdrawal testing",
            note: "These IBANs are for testing purposes only. Use in test/development environment.",
            country: country.toUpperCase(),
            testIBANs: testIBANs,
            instructions: {
                step1: "Copy any IBAN from below",
                step2: "Use the corresponding Bank Code in the dropdown",
                step3: "Enter any name as Account Holder Name",
                step4: "Enter withdrawal amount (min 50 AED or 5 KWD)"
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Get supported banks for a country
export const getSupportedBanks = async (req, res) => {
    try {
        const { country = "UAE" } = req.query;
        const banksInfo = bankValidationService.getSupportedBanks(country);

        res.status(200).json({
            success: true,
            country,
            ...banksInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
