import Wallet from "../models/Wallet.js"
import User from "../models/User.js"
import Transaction from "../models/Transaction.js"
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

        // Find or create wallet with proper currency
        let wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                currency: userCurrency,
                transactions: []
            })
        }

        // Add transaction only after payment verification
        const transaction = {
            type: "DEPOSIT",
            amount: verifiedAmount,
            description: `Funds added via ${paymentMethod || 'payment gateway'}`,
            paymentMethod: paymentMethod || 'card',
            status: "COMPLETED",
            paymentSessionId,
            gatewayTransactionId: paymentVerification.transactionId,
            createdAt: new Date()
        }

        wallet.transactions.push(transaction)
        wallet.balance += verifiedAmount
        await wallet.save()

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
